# Entrega durável do webhook

Como fazer o webhook de entrada sobreviver a um deploy no meio da conversa do cliente.

O problema não é hipotético: em produção, derrubar o processo enquanto uma mensagem estava sendo
processada deixava o cliente sem resposta — e nada registrava a perda. Era o pior formato de falha,
porque o painel mostrava tudo verde enquanto a pessoa do outro lado esperava.

## O que estava quebrado

Três coisas somadas, e nenhuma delas bastava sozinha:

1. **O nonce era gravado antes do processamento**, com a janela cheia de 5 minutos. A reentrega da
   Meta é o único socorro que existe para entrega perdida — e ela batia numa porta que o próprio
   processo morto tinha fechado.
2. **Os efeitos de host rodavam dentro da requisição do webhook.** Motor de fluxo, IA, integrações:
   tudo I/O de rede, tudo morto junto com o processo.
3. **Nada distinguia reentrega de trabalho novo**, então proteger o item 1 arriscava rodar a regra
   de negócio duas vezes para a mesma mensagem do cliente.

## O desenho

### Claim curto, confirm no fim

`claimWebhookDelivery` reivindica a entrega por `WEBHOOK_CLAIM_TTL_SECONDS` (60s). Só depois de o
processamento ir até o fim, `confirmWebhookDelivery` estende para `WEBHOOK_NONCE_TTL_SECONDS` (300s).

A consequência é a que interessa: **se qualquer coisa falhar no meio, o claim curto expira e a
reentrega da Meta ainda encontra a porta aberta.** Quem chama `ReceiveWebhookUseCase` não precisa
fazer nada — ele já chama os dois no lugar certo.

O que o host precisa fazer é implementar `confirm` no seu `NonceStoreInterface`:

```ts
const nonceStore: NonceStoreInterface = {
  async setIfAbsent(key, ttlSeconds) {
    return (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK'
  },
  // Um SET simples, sem NX: a chave já é sua, você só está estendendo o prazo.
  async confirm(key, ttlSeconds) {
    await redis.set(key, '1', 'EX', ttlSeconds)
  },
}
```

`confirm` é opcional **apenas** para não quebrar host existente, e deixar de implementá-lo tem
preço: sem ele o claim de 60s expira e nunca é estendido, então a janela anti-replay encolhe de 5
minutos para 1. A dedupe por `waMessageId` ainda segura o efeito visível ao cliente, mas é trabalho
repetido que não precisava existir. São quatro linhas — implemente.

### Fila para os efeitos de host

`ReceiveWebhookUseCase` aceita `inboundQueue`. Com ela, a requisição do webhook faz só o que é
rápido e local (persistir a mensagem) e enfileira o resto. Sem ela, o comportamento é o de sempre:
os efeitos rodam inline.

```ts
import { ReceiveWebhookUseCase, type InboundDispatchQueueInterface } from '@adatechnology/meta-whatsapp-module'

const inboundQueue: InboundDispatchQueueInterface = {
  async enqueue(job, options) {
    await queue.add('inbound', job, { jobId: options.jobId })
  },
}

const receiveWebhook = new ReceiveWebhookUseCase({ ...params, inboundQueue })
```

A porta existe para o módulo **não** escolher a tecnologia — BullMQ, SQS, o que o host já tiver.
Mas exige duas garantias, e sem as duas o padrão não entrega o que promete:

| Garantia | Por quê |
|---|---|
| **Durabilidade** | O job precisa sobreviver à morte do processo que o enfileirou. Fila em memória reintroduz exatamente a perda que este desenho existe para evitar. |
| **Retentativa com backoff** | O destino dos hooks (n8n, IA, API de terceiro) também cai em deploy. Sem retry, o job falha uma vez e a conversa morre do mesmo jeito. |

### O worker

Do outro lado da fila, `ProcessInboundDispatchUseCase` roda os efeitos:

```ts
import { InboundEffectsDispatcher, ProcessInboundDispatchUseCase } from '@adatechnology/meta-whatsapp-module'

const process = new ProcessInboundDispatchUseCase(
  new InboundEffectsDispatcher({ sessionRepository, hooks, realtime }),
)

new Worker('inbound', async (job) => process.execute(job.data), {
  connection,
  // Sem isto o padrão não vale nada: é o retry que transforma "processo caiu" em "atraso".
  ...{ attempts: 8, backoff: { type: 'exponential', delay: 3_000 } },
})
```

É o mesmo `InboundEffectsDispatcher` que o caminho inline usa — um só corpo de regra para os dois
caminhos, porque duas cópias divergiriam.

**Deixe a exceção propagar dentro do worker.** É ela que faz a fila contar a tentativa e reagendar.
Capturar para logar transforma falha recuperável em mensagem perdida em silêncio — que é o bug
original, reencenado um andar abaixo.

### jobId estável

`buildInboundJobId` deriva o id da própria mensagem (`wa-inbound-message:<id>`,
`wa-inbound-status:<id>:<status>`). Reentrega da Meta e re-enfileiramento produzem o mesmo id, e a
fila descarta o segundo em vez de rodar o efeito duas vezes. `ReceiveWebhookUseCase` já faz isso ao
enfileirar; use a função direto se você enfileirar por conta própria.

## O que mais o host precisa cuidar

O SDK cobre a entrega. Duas coisas ficam do lado de fora, e sem elas metade do ganho evapora:

- **Responder com o status certo.** `200` para a Meta significa "recebi, não precisa reentregar".
  Responder `200` numa falha é abrir mão do único socorro que existe. Devolva `200` no sucesso e nos
  casos em que não há o que reentregar (duplicata, assinatura inválida) — e `5xx` no resto.
- **Drenar no `SIGTERM`.** Antes de fechar o socket, faça o healthcheck responder `503` e espere
  alguns segundos, para o balanceador tirar a instância de rotação antes que ela morra com
  requisição em voo. Em PaaS com healthcheck (Railway, Render), configure o path — é o que faz a
  instância nova entrar antes de a velha sair.

## Checklist

- [ ] `confirm` implementado no `NonceStoreInterface`
- [ ] `inboundQueue` apontando para fila **durável**, não em memória
- [ ] Worker com `attempts` e backoff exponencial
- [ ] Worker deixa a exceção propagar
- [ ] Alerta quando as tentativas se esgotam — job descartado em silêncio é a falha original de volta
- [ ] Webhook responde `5xx` em falha, não `200`
- [ ] Drain no `SIGTERM` e healthcheck configurado no PaaS
