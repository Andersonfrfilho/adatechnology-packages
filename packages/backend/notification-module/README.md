# @adatechnology/notification-module

**Notificação multicanal** como módulo plugável: inbox, push, e-mail e WhatsApp saindo de uma
chamada só, com preferência por usuário, horário de silêncio, deduplicação, agendamento, retry
classificado e supressão. TypeScript, Drizzle + PostgreSQL, roda em Bun e Node.

- Tabelas em `pgSchema('notification')`, com migrations e journal próprios — nunca toca o `public`
- Rotas HTTP prontas para `Bun.serve` **e** uWebSockets.js, inclusive o SSE do inbox
- Worker e cron prontos; a fila é porta, não conexão própria
- Multiempresa por construção, com teste de isolamento por renderização de SQL

## Instalação

```bash
bun add @adatechnology/notification-module @adatechnology/notification-contracts @adatechnology/module-http
```

`drizzle-orm` é peer.

## Migrations e versões do drizzle

As migrations vêm em dois formatos: journal (drizzle-orm 0.x) e `migrations-v1` (drizzle-orm 1.x,
que recusa pasta com `meta/_journal.json`). Host com drizzle-orm 1.x deve passar `layout: 'v1'`:

```ts
await runNotificationMigrations({ db, migrate, layout: 'v1' })
```

Sem `layout`, o módulo tenta o journal e, se o migrator recusar, usa o v1.

## Uso mínimo

```ts
import { createNotificationModule, runNotificationMigrations } from '@adatechnology/notification-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runNotificationMigrations({ db, migrate })

const notification = createNotificationModule({
  db,
  config: {
    defaultLocale: 'pt-BR',
    defaultTimezone: 'America/Sao_Paulo',
    suppressionHmacKey: environment.NOTIFICATION_SUPPRESSION_KEY,
  },
  providers: {
    recipientResolver,        // o módulo NÃO conhece a tabela de usuários do host
    channels: { push, email, whatsapp },
  },
})

await notification.useCases.sendNotification.execute({
  companyId,
  recipientUserId: userId,
  category: 'order',
  templateKey: 'order.ready',
  payload: { orderNumber: '1042' },
  dedupeKey: `order:${orderId}:ready`,
})
```

Sem `channels` explícito, uma chamada e o módulo decide por onde sai: lê a preferência do usuário, respeita o horário de
silêncio, verifica supressão, monta uma `delivery` por canal e enfileira. `companyId` vem sempre
do contexto autenticado.

## `dedupeKey` não é detalhe

`order:1042:ready` garante que o cliente recebe **um** aviso, mesmo se o job rodar duas vezes, se
o webhook chegar em duplicata ou se dois pods processarem o mesmo evento. Sem ela, retry vira spam
— e spam em push é desinstalação.

## Rotas prontas

```ts
import { createNotificationRoutes } from '@adatechnology/notification-module'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

const http = createModuleFetchRouter({
  routes: createNotificationRoutes({ module: notification }),
  basePath: '/v1',
  authResolver,
})

if (http.match(request)) return http.handle(request)
```

| Recurso | Rotas |
|---|---|
| Inbox | `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/stream` (SSE), `POST /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` |
| Devices | `POST /notification-devices`, `DELETE /notification-devices/:id` |
| Preferências | `GET/PUT /notification-preferences` |
| Templates | `GET/PUT /notification-templates` |
| Webhook de recibo | `POST /notification-webhooks/:driver` |

O mesmo `createModuleFetchRouter` monta o `catalog-module`: **um router para as duas tabelas**.
Para uWebSockets, troque por `mountModuleRoutes` de `@adatechnology/module-http/uws`.

⚠️ **O `idleTimeout` do `Bun.serve` precisa ser MAIOR que o heartbeat do SSE** (default 25 s).
Menor, a conexão morre antes do primeiro batimento e o sino mostra contagem velha sem erro nenhum.

O webhook **só é publicado se houver `webhookSecret`**. Sem segredo, a rota não sobe — publicar
aceitando qualquer payload é o oposto de fail-closed (`security.md` §3). A assinatura é conferida
sobre o `rawBody`, com janela de timestamp e nonce contra replay.

## Worker e cron

```ts
import { createNotificationWorker, createNotificationSchedules } from '@adatechnology/notification-module'
```

O worker consome a fila e despacha; os `schedules` cobrem agendadas, expiradas e purge de
retenção. A `QueuePort` é injetada — o módulo nunca abre conexão de broker. Sem fila, o
`createInProcessQueue` serve para desenvolvimento e teste.

## Retry sai da classificação do driver

O driver devolve `sent` / `retriable` / `permanent` / `invalid-target`, e o módulo reage:
`retriable` reenfileira com backoff, `permanent` para, e **`invalid-target` desativa o device ou
suprime o e-mail**. Token de push morre o tempo todo — sem essa distinção, cada usuário que troca
de celular deixa um token que a fila tenta para sempre.

## Privacidade

Telefone e e-mail nunca vão para log: `maskTarget` para exibir, `hashTarget` (HMAC) para a chave
de supressão. A lista de supressão existe para não enviar, não para virar cadastro de contatos
(`security.md` §1).

## Modelo padrão de e-mail

`module.standardEmail` (`StandardEmailService`) cuida da chave `notification.standard-email`:

- `ensureTemplate({ companyId })` grava a v1 embutida **só se a identidade não tem nenhuma linha**
  (ativa ou não): versão editada ou desativada nunca é sobrescrita. Idempotente; `23505` na corrida
  pela v1 = "já existe". O host o chama **no pré-deploy** (por empresa) — o envio não cria modelo.
- `resolveTemplate` devolve a versão ativa e utilizável da empresa; sem ela, o **embutido
  (`version: 0`, `source: 'builtin'`)** — rede de segurança, com `warn` de fallback sem o HTML.
- `render({ companyId, input })` resolve e renderiza (`html`, `text`, `bytes`, `tooLarge`).
- `restoreDefault({ companyId })` grava uma **versão nova** com o conteúdo embutido; o histórico fica.
- Rota `POST /notification-templates/:id/restore-default` (escopo `admin`): `201 { data }`; `400` se o
  id não é do modelo padrão; `409` se recusada.
- Erros: `StandardEmailTemplateInvalidError` (400, `NOTIFICATION_STANDARD_EMAIL_TEMPLATE_INVALID`,
  `details: { missing, unsafe }`) ao salvar modelo inutilizável; `StandardEmailTemplateRequiredError`
  (409, `NOTIFICATION_STANDARD_EMAIL_TEMPLATE_REQUIRED`) ao remover/desativar o padrão.

## Licença

MIT © Ada Technology
