# Bot de recepção com fluxos

Um atendente automático de recepção montado só com o grafo do editor e o runner do módulo: menu com
descrições, dúvidas respondidas por palavra-chave, pedido de reserva com data validada, resumo com os
dados do cliente, um código gerado pelo sistema e encaminhamento a uma pessoa conforme o horário.

O exemplo é genérico (uma recepção qualquer: clínica, escritório, espaço de eventos). Troque os
textos e as ações pelas do seu produto.

## 1. Ligar o runner

```ts
import { createMetaWhatsAppModule } from '@adatechnology/meta-whatsapp-module'

const whatsapp = createMetaWhatsAppModule({
  db,
  config: { phoneNumberId, accessToken, webhookVerifyToken, appSecret },
  nonceStore,
  features: {
    flowRunner: {
      startFlowKey: 'main',
      timeZone: 'America/Sao_Paulo',
      globalKeywords: [
        { keywords: ['menu', 'voltar ao início'], target: 'restart' },
        { keywords: ['atendente', 'falar com pessoa'], target: 'handoff', match: 'word' },
      ],
      rejectionMessages: {
        'before-min-date': 'Essa data já passou. Pode mandar outra?',
        'not-after-reference': 'A saída precisa ser depois da entrada.',
      },
      handoff: {
        message: 'Já chamei alguém da equipe, {{contactFirstName}}. É só aguardar por aqui.',
        outOfHoursMessage: 'Nossa equipe atende de segunda a sexta, das 8h às 18h. Respondemos assim que abrirmos.',
        businessHours: {
          timeZone: 'America/Sao_Paulo',
          windows: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '08:00', end: '18:00' })),
        },
      },
    },
  },
  hooks: {
    // Sem hook, ou devolvendo 'continue', o runner atende. 'handled' = o host já respondeu.
    onMessageReceived: async () => ({ outcome: 'continue' }),
    // Sem o número inteiro no log: etapa, fluxo, nó e os 4 últimos dígitos.
    onFlowRunnerError: (error, { stage, flowKey, nodeId, whatsappNumber }) =>
      logger.error('flow_runner_failed', { stage, flowKey, nodeId, contact: `****${whatsappNumber.slice(-4)}` }),
    onHumanRequested: async (session) => notifyTeam(session.companyId),
  },
})
```

`businessHours` também aceita uma função `(companyId) => Promise<BusinessHours | undefined>` para o
horário vir da configuração de cada empresa, sem deploy.

## 2. Registrar o que o grafo chama

```ts
// Ação do produto. O contexto devolvido fica disponível para os nós seguintes.
whatsapp.flows!.registerFlowAction('create_booking_request', async ({ session, context }) => {
  const request = await bookingRequests.create({
    companyId: session.companyId,
    whatsappNumber: session.whatsappNumber,
    date: String(context.date),
    people: Number(context.people),
  })
  return { context: { requestCode: request.code } }
})

// Opções que dependem do momento: horários livres do dia escolhido.
whatsapp.flows!.registerDynamicChoiceProvider('free_slots', async ({ context, page, pageSize }) => {
  const slots = await agenda.freeSlots({ date: String(context.date), offset: page * pageSize, limit: pageSize + 1 })
  return {
    options: slots.slice(0, pageSize).map((slot) => ({ id: slot.id, title: slot.label, description: slot.room })),
    hasMore: slots.length > pageSize,
  }
})
```

## 3. O fluxo principal (`main`)

```json
{
  "key": "main",
  "label": "Recepção",
  "startNodeId": "menu",
  "version": 1,
  "nodes": {
    "menu": {
      "id": "menu",
      "type": "menu",
      "question": "Olá, {{contactFirstName}}! Como posso ajudar?",
      "options": [
        ["book", "📅 Pedir reserva"],
        ["faq", "❓ Tirar dúvida"],
        ["human", "🙋 Falar com pessoa"]
      ],
      "optionDetails": {
        "book": { "description": "Escolha o dia e o horário" },
        "faq": { "description": "Horário, endereço, estacionamento" },
        "human": { "description": "Alguém da equipe responde" }
      },
      "fallbackMessage": "Escolha uma das opções da lista, ou escreva sua dúvida.",
      "next": {
        "byAnswer": { "book": "flow:booking", "faq": "faq_ask", "human": "handoff" },
        "byKeyword": { "horario": "faq_hours", "endereco": "faq_address", "estacionamento": "faq_parking" },
        "default": "menu"
      }
    },
    "faq_ask": {
      "id": "faq_ask",
      "type": "question",
      "question": "Qual é a sua dúvida?",
      "maxInvalidAnswers": 1,
      "next": {
        "byAnswer": {},
        "byKeyword": { "horario": "faq_hours", "endereco": "faq_address", "estacionamento": "faq_parking" },
        "default": "handoff"
      }
    },
    "faq_hours": { "id": "faq_hours", "type": "action", "directMessage": "Atendemos de segunda a sexta, das 8h às 18h." },
    "faq_address": { "id": "faq_address", "type": "action", "directMessage": "Estamos na Rua Exemplo, 100." },
    "faq_parking": { "id": "faq_parking", "type": "action", "directMessage": "Há estacionamento conveniado ao lado." },
    "handoff": { "id": "handoff", "type": "action", "actionKind": "handoff" }
  }
}
```

O que acontece:

- As opções têm descrição, então o menu sai como **lista** (com até 3 opções simples sairia como
  botões). Título acima de 24 caracteres faria a lista virar texto numerado — o cliente ainda responde
  "2".
- "Qual o horário?" na primeira mensagem vai direto para `faq_hours`, sem mostrar o menu:
  `byKeyword` do nó inicial vale para quem chega.
- `faq_ask` aceita texto livre: palavra conhecida responde; o resto cai no `default` (encaminhamento).
- `faq_hours` é um nó de ação sem `actionKind` — um **nó de mensagem**: envia o texto e termina (ou
  segue o `next`, se houver).

## 4. O pedido de reserva (`booking`)

```json
{
  "key": "booking",
  "label": "Pedido de reserva",
  "startNodeId": "date",
  "version": 1,
  "nodes": {
    "date": {
      "id": "date",
      "type": "question",
      "questionType": "date",
      "contextKey": "date",
      "question": "Para qual dia? Pode escrever 24/12, \"amanhã\" ou \"hoje\".",
      "validation": { "minDate": "today" },
      "fallbackMessage": "Não entendi a data. Use dia/mês, por exemplo 24/12.",
      "next": "slot"
    },
    "slot": {
      "id": "slot",
      "type": "dynamic_choice",
      "choiceProvider": "free_slots",
      "contextKey": "slotId",
      "question": "Estes são os horários livres:",
      "listButtonLabel": "Ver horários",
      "next": "people"
    },
    "people": {
      "id": "people",
      "type": "question",
      "questionType": "int",
      "contextKey": "people",
      "question": "Quantas pessoas?",
      "validation": { "min": 1, "max": 8 },
      "fallbackMessage": "Mande um número de 1 a 8.",
      "next": "notes"
    },
    "notes": {
      "id": "notes",
      "type": "question",
      "questionType": "text",
      "contextKey": "notes",
      "question": "Alguma observação? Se não, responda \"pular\".",
      "skipKeywords": ["pular", "não", "nenhuma"],
      "validation": { "maxLength": 300 },
      "next": "create"
    },
    "create": { "id": "create", "type": "action", "actionKind": "create_booking_request", "next": "summary" },
    "summary": {
      "id": "summary",
      "type": "action",
      "directMessage": "Pedido *{{requestCode}}* registrado: {{date}}, {{people}} pessoa(s). Vamos confirmar por aqui, {{contactFirstName}}."
    }
  }
}
```

O que acontece:

- `date` aceita `24/12`, `24/12/2026`, `hoje`, `amanhã` e `depois de amanhã`. Guarda `2026-12-24`; no
  texto, `{{date}}` aparece como `24/12/2026`. Data no passado volta com a mensagem de
  `rejectionMessages['before-min-date']`.
- Duas respostas inválidas seguidas no mesmo nó chamam uma pessoa (padrão `maxInvalidAnswers: 2`).
- `slot` pede ao provedor 9 opções por página e acrescenta "Ver mais" quando há mais; o id escolhido
  vai para `slotId`.
- `notes` aceita "pular" e guarda `null`.
- `create_booking_request` devolve `{ requestCode }`, e o `summary` mostra o código.

Para pedir também a saída de uma estadia, uma segunda pergunta `date` com
`"validation": { "afterContextKey": "date" }` recusa qualquer dia igual ou anterior.

## 5. Encaminhamento e horário

O nó `handoff`, a palavra global "atendente" e o excesso de respostas inválidas fazem a mesma coisa:
põem a conversa na fila (`conversations.requestHuman` — dispara `onHumanRequested` e
`onConversationModeChanged`) e mandam a mensagem do horário. `actionParams.message` e
`actionParams.outOfHoursMessage` no nó sobrescrevem os textos só ali. O contexto recebe
`handoffWithinBusinessHours`, que um nó `condition` pode usar.

Palavras globais (`globalKeywords`) casam a mensagem inteira por padrão (`match: 'exact'`). Com
`match: 'word'` a entrada vale quando a palavra ou frase aparece inteira dentro da mensagem ("quero falar com
o atendente"), sem acento e sem caixa; fragmento de outra palavra não conta e, havendo várias, vence a mais longa.

Depois disso a conversa fica em silêncio até alguém assumir (`takeover`) ou devolver ao bot
(`release`). Para reabrir o menu ao devolver:

```ts
await whatsapp.conversations.release.execute({ companyId, whatsappNumber, actorId })
await whatsapp.flows!.runner!.start({ companyId, whatsappNumber })
```

## 6. Testar no simulador sem gastar mensagem

Com `features.previewContacts: true` (só em ambiente de teste), o simulador do `conversations-ui`
conversa pelo número `DEFAULT_PREVIEW_CONTACT` (começa com `0`) quando o cliente do simulador recebe
`from: DEFAULT_PREVIEW_CONTACT` — os dois lados precisam estar ligados — e o módulo responde sem chamar a Meta.
A rota da ponte assina com o app secret: **exige sessão autenticada e nunca vai para produção**.

```ts
// Registrada só fora de produção, atrás da sessão do painel.
if (environment.isPreviewEnabled) app.post('/v1/preview/inbound', requireSession, async (request) => {
  const payload = whatsapp.webhook.buildPreviewPayload(request.body)
  const rawBody = JSON.stringify(payload)
  await whatsapp.webhook.receive.execute({ companyId, rawBody, signatureHeader: signWithAppSecret(rawBody) })
})
```

## Checklist antes de publicar

- [ ] Todo nó de escolha tem `fallbackMessage`.
- [ ] Todo caminho termina em mensagem final ou em encaminhamento.
- [ ] Títulos dentro dos tetos (o editor acusa: botão 20, linha de lista 24, descrição 72).
- [ ] Nenhuma pergunta pede dado sensível que o atendimento não precise.
- [ ] Todo `actionKind` e `choiceProvider` usado no grafo está registrado no host.
