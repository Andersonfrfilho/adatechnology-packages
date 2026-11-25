# @adatechnology/meta-whatsapp-module

Módulo de conversa sobre WhatsApp Cloud API: schema e migrations próprios (`meta_whatsapp`),
repositórios, use cases (envio, transcript, atendimento humano, fluxos) e webhook — tudo atrás de
portas que o host injeta. Tipos e portas vivem em `@adatechnology/meta-whatsapp-contracts`.

O módulo não lê `process.env` nem abre conexão: `db`, credenciais, storage, cache e fila chegam por
parâmetro.

## Instalação

```bash
bun add @adatechnology/meta-whatsapp-module @adatechnology/meta-whatsapp-contracts drizzle-orm
```

`drizzle-orm` é peer dependency (`>=0.36 <2`): o módulo usa a conexão do host.

## Migrations

O pacote publica as mesmas migrations em dois formatos, porque os migrators do drizzle-orm não se
entendem:

| Formato | Pasta | Migrator |
|---|---|---|
| `v1` (padrão) | `dist/migrations/<timestamp>_<nome>/migration.sql` | drizzle-orm 1.x |
| `journal` | `dist/migrations-journal/` (`meta/_journal.json` + `NNNN_<nome>.sql`) | drizzle-orm 0.36–0.45 |

```ts
import { migrate } from 'drizzle-orm/postgres-js/migrator' // ou node-postgres, bun-sql…
import { runMetaWhatsAppMigrations } from '@adatechnology/meta-whatsapp-module'

await runMetaWhatsAppMigrations({ db, migrate, layout: 'journal' }) // drizzle-orm 0.x
await runMetaWhatsAppMigrations({ db, migrate })                    // drizzle-orm 1.x (padrão)
```

Sem `layout`, o módulo tenta `v1` e cai para `journal` quando o migrator 0.x recusa a pasta (a recusa
acontece antes de qualquer SQL). O journal fica em `drizzle.meta_whatsapp_migrations`, separado do
journal do host. **Só se sobe: 0.x → 1.x, nunca de volta.** Os dois migrators gravam na mesma tabela
com critérios diferentes, e voltar ao 0.x depois de rodar com 1.x pode reaplicar migration já
aplicada. Para chamar o migrator por conta própria:
`metaWhatsAppMigrationsFolder({ layout: 'journal' })` + `META_WHATSAPP_MIGRATIONS_TABLE`.

Nos dois formatos o SQL é idêntico, e o `when` do journal é o timestamp do nome da pasta v1 — o mesmo
`created_at` que o migrator 1.x grava. Depois de `db:generate`, rode
`bun scripts/generate-journal-migrations.ts`; o `migrations.test.ts` reprova divergência.

## Montando o módulo

```ts
import { createMetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'

const whatsapp = createMetaWhatsAppModule({
  db,
  config: { phoneNumberId, accessToken, webhookVerifyToken, appSecret },
  nonceStore,                        // anti-replay do webhook (Redis, Postgres…)
  providers: { objectStorage, realtime, inboundQueue },
  hooks: { onMessageReceived, onConversationModeChanged },
})
```

As conversas automáticas são grafos de fluxo editados no editor do `@adatechnology/conversations-ui`
e interpretados por `whatsapp.flows` (`FlowInterpreter`); ações do produto entram por
`whatsapp.flows.registerFlowAction`. O simulador de conversa do mesmo pacote
(`ConversationSimulatorPanel` + `createPreviewBridgeClient`) entrega pelo webhook real, assinado no
servidor.

Sem Redis: ver [`docs/postgres-only.md`](./docs/postgres-only.md) (nonce store e fila em tabela).
Durabilidade do webhook: [`docs/webhook-durability.md`](./docs/webhook-durability.md).

## Mensagens interativas

```ts
await whatsapp.conversations.send.sendInteractive({
  companyId,
  whatsappNumber,
  sender: 'bot',
  startState: 'start',
  interactive: {
    kind: 'list',
    body: 'Qual horário?',
    buttonLabel: 'Ver horários',
    sections: [
      { title: 'Manhã', rows: [{ id: 'morning_9', title: '09:00', description: 'Unidade centro' }] },
      { title: 'Tarde', rows: [{ id: 'afternoon_14', title: '14:00' }] },
    ],
  },
})

await whatsapp.conversations.send.sendInteractive({
  companyId,
  whatsappNumber,
  sender: 'agent',
  agentUserId,
  startState: 'start',
  interactive: { kind: 'buttons', body: 'Confirma?', buttons: [{ id: 'confirm', title: '✅ Confirmar' }] },
})
```

Mesmo caminho do `sendText`: janela de 24h (`WindowExpiredError`), envio pelo canal e registro no
transcript (`type: 'interactive'`, `content` = corpo, `payload.interactive` = a mensagem com ids e
títulos), idempotente pelo `waMessageId`. Antes de tudo, os limites de `WHATSAPP_CHOICE_LIMIT` são
conferidos e a violação vira `InteractiveLimitExceededError` (422) com **todas** as violações em
`violations`:

| Campo | Limite |
|---|---|
| botões | 1 a 3, título ≤ 20 |
| linhas de lista | 1 a 10 no total, título ≤ 24, descrição ≤ 72 |
| seções | até 10; título ≤ 24, obrigatório com mais de uma |
| rótulo do botão da lista | ≤ 20 |
| corpo | ≤ 1024 |
| ids | únicos na mensagem |

Os caracteres são contados por code point (um emoji = 1). Para validar ao publicar um fluxo, use
`listInteractiveLimitViolations` dos contracts. Canal sem `sendInteractiveButtons` recebe os botões
como lista (`fallbackListLabel`, padrão `DEFAULT_FALLBACK_LIST_LABEL`).

## Atendimento humano e auditoria

```ts
await whatsapp.conversations.requestHuman.execute({ companyId, whatsappNumber })           // fila "aguardando"
await whatsapp.conversations.takeover.execute({ companyId, whatsappNumber, agentUserId })  // atendente assume
await whatsapp.conversations.release.execute({ companyId, whatsappNumber, actorId })       // volta ao bot

hooks: {
  onConversationModeChanged: async (change) => {
    // change: { companyId, whatsappNumber, kind: 'takeover' | 'release' | 'human-requested',
    //           mode, assignedUserId, actorId, occurredAt }
    await auditTrail.record(change)
  },
}
```

O hook roda depois de a mudança estar gravada; erro lançado nele sobe para quem chamou. `takeover`
aceita `actorId` quando quem executa não é o próprio atendente (padrão: `agentUserId`); em `release` e
`requestHuman`, `actorId` omitido é `null` (o sistema). `requestHuman` também dispara
`onHumanRequested`.

## Runner de fluxo

Com `features.flowRunner`, o próprio módulo dirige a conversa pelo grafo publicado depois que
`onMessageReceived` devolve `'continue'` (ou quando não há hook): envia a pergunta, botões (até 3
opções simples) ou lista (com descrição e seção), valida a resposta, avança, grava posição e contexto
numa escrita só, registra tudo no transcript e segue saltos `flow:<chave>`. **Desligado por omissão**
— host que já dirige o próprio fluxo continua igual.

```ts
const whatsapp = createMetaWhatsAppModule({
  // ...
  features: {
    flowRunner: {
      startFlowKey: 'main',
      timeZone: 'America/Sao_Paulo',
      globalKeywords: [
        { keywords: ['menu', 'início'], target: 'restart' },
        { keywords: ['atendente', 'pessoa'], target: 'handoff' },
      ],
      handoff: {
        message: 'Já chamei alguém da equipe, {{contactFirstName}}.',
        outOfHoursMessage: 'Estamos fechados agora. Respondemos às 8h.',
        businessHours: {
          timeZone: 'America/Sao_Paulo',
          windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '08:00', end: '18:00' })),
          closedDates: ['2026-12-25'],
        },
      },
      resolveVariables: async ({ session }) => ({ unitName: await units.nameFor(session.companyId) }),
    },
  },
  hooks: {
    // Nunca o número inteiro no log (é dado pessoal): etapa, fluxo, nó e os 4 últimos dígitos.
    onFlowRunnerError: (error, { stage, flowKey, nodeId, whatsappNumber }) =>
      logger.error('flow_runner_failed', { stage, flowKey, nodeId, contact: `****${whatsappNumber.slice(-4)}` }),
  },
})

// Ação do produto: o contexto devolvido aparece no nó seguinte por {{code}}.
whatsapp.flows!.registerFlowAction('create_request', async ({ session, context }) => {
  const request = await requests.create({ companyId: session.companyId, date: context.date })
  return { context: { code: request.code } }
})

// Opções calculadas na hora, com "ver mais" automático.
whatsapp.flows!.registerDynamicChoiceProvider('free_slots', async ({ context, page, pageSize }) => {
  const slots = await agenda.freeSlots({ date: String(context.date), offset: page * pageSize, limit: pageSize + 1 })
  return {
    options: slots.slice(0, pageSize).map((slot) => ({ id: slot.id, title: slot.label, description: slot.room })),
    hasMore: slots.length > pageSize,
  }
})
```

| No nó | O que o runner faz |
|---|---|
| `question` + `questionType` | valida (`date`, `int`, `money`, `cpf`, `text`) e guarda o valor convertido em `contextKey` (data `yyyy-mm-dd`, número) |
| `validation` | `minDate: 'today'`, `afterContextKey`, `min`/`max`, `minLength`/`maxLength` |
| `skipKeywords` | a resposta pula a pergunta: `contextKey` recebe `null` |
| resposta inválida | `fallbackMessage` (ou `rejectionMessages` / texto padrão) e repergunta; na `maxInvalidAnswers`ª (padrão 2) chama uma pessoa |
| `menu` / `choice` | aceita toque, número ("2"), rótulo ou palavras do rótulo; `optionDetails` dá descrição e seção |
| `next.byKeyword` | texto livre com a palavra (sem acento/caixa) vai ao destino — FAQ sem menu; na primeira mensagem também vale |
| `dynamic_choice` | opções do provedor em `choiceProvider`, páginas de 9 + "ver mais", id escolhido em `contextKey` |
| `directMessage` | enviado ao entrar no nó, com `{{chave}}` interpolado (contexto, variáveis do host, `contactName`, `contactFirstName`) |
| `action` sem `actionKind` | nó de mensagem: envia o `directMessage` e segue |
| `actionKind: 'handoff'` | `requestHuman` (dispara `onHumanRequested` e `onConversationModeChanged`) + mensagem conforme o horário; `handoffWithinBusinessHours` vai para o contexto |

**Garantias de execução**

- **Um turno por conversa de cada vez.** O runner roda dentro de `pg_advisory_xact_lock` por
  empresa+número (`PostgresAdvisoryFlowTurnLock`, padrão): duas mensagens do mesmo cliente nunca leem a
  mesma posição. Custa uma conexão do pool por conversa em atendimento simultâneo; troque por outro
  lock em `providers.flowTurnLock`.
- **No máximo uma vez por mensagem.** A primeira escrita do turno grava o id da mensagem
  (`__flow.lastInboundId`) antes de qualquer envio; reentrega da Meta ou retentativa da fila devolve
  `'duplicate'` sem reenviar nem reavisar a equipe. Erro depois dessa escrita **não sobe** — vai para
  `onFlowRunnerError` (ou é descartado sem o gancho) e a conversa fica no último ponto gravado. Erro
  antes dela (leitura do grafo, banco fora) sobe, e a retentativa é segura.
- **Fuso obrigatório.** `timeZone` (ou `handoff.businessHours.timeZone`, quando fixo) define "hoje";
  sem ele o módulo falha na montagem. Servidor em UTC aceitaria "hoje" errado entre 21h e meia-noite.
- **Variáveis do host vencem.** Em `{{chave}}`, `resolveVariables`, `contactName` e `contactFirstName`
  têm precedência sobre as respostas guardadas no contexto — uma resposta não troca o nome que o
  sistema conhece. Use chaves distintas para o que o cliente responde.
- **Áudio, imagem e afins** num nó que espera texto recebem `nonTextAnswerMessage` e a pergunta de novo,
  sem contar tentativa. Quem transcreve áudio responde pelo `onMessageReceived`. Botão de template
  (`type: 'button'`) vale pelo texto do botão.
- **Resposta fora das opções**: `unmatchedChoice: 'reask'` (padrão) repergunta e conta tentativa;
  `'default'` (no runner ou no nó) segue `next.default` guardando o texto — o comportamento do
  interpretador puro. O editor avisa quando um `default` ficaria sem efeito.
- **Grafo removido**: conversa parada num fluxo que não existe mais volta ao início do fluxo de partida
  e o erro sai em `onFlowRunnerError`.

Depois de um encaminhamento que encerra o fluxo, a conversa fica em silêncio até alguém assumir ou
devolver ao bot (`whileAwaitingHuman: 'continue'` muda isso). Palavras globais continuam valendo:
"menu" reabre o fluxo **sem** tirar o pedido da fila (a equipe ainda responde).
`whatsapp.flows.runner.start({ companyId, whatsappNumber })` abre o fluxo sem esperar mensagem.
Contexto reservado: `__flow` (tentativas e página da escolha dinâmica).

Guia completo: [`docs/front-desk-bot-with-flows.md`](./docs/front-desk-bot-with-flows.md).

## Contatos do simulador

Com `features.previewContacts`, envio para número que começa com `0` (`isPreviewContact`; nenhum
`wa_id` real começa com zero) volta `preview.<uuid>` sem chamar a Meta. Janela, transcript, SSE e
status seguem iguais. É opt-in nas duas pontas: o servidor liga `features.previewContacts` e o
simulador do `conversations-ui` passa `from: DEFAULT_PREVIEW_CONTACT` (o `from` continua obrigatório e
é usado como veio — quem não muda nada continua com o mesmo contato e a mesma conversa). Só um lado
ligado não serve: sem a flag, o servidor responderia pela Meta a um número que não existe.

Na rota da ponte do simulador, monte o payload com o `phone_number_id` deste módulo — com o padrão
do builder, o filtro de número descartava a entrega. **A rota assina com o app secret: exige a sessão
autenticada do painel e nunca é registrada em produção** (quem a alcança forja mensagens de qualquer
número). Registre-a só onde `features.previewContacts` está ligado:

```ts
const payload = whatsapp.webhook.buildPreviewPayload(command) // command: PreviewInboundCommand
const rawBody = JSON.stringify(payload)
await whatsapp.webhook.receive.execute({ companyId, rawBody, signatureHeader: sign(rawBody, appSecret) })
```
