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
journal do host. Para chamar o migrator por conta própria:
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
