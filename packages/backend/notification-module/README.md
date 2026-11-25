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

### Escopos

| Rotas | Escopo exigido (basta um) |
|---|---|
| `admin`: modelos (`/notification-templates*`, definições, variáveis) e políticas de categoria | `notification:admin` |
| `service`: `POST /notifications` (envio por máquina) | `notification:send` ou `notification:admin` |
| `user`: inbox, devices, preferências | a pessoa autenticada; o objeto é sempre dela |

Sem o escopo a rota responde `403`. Vocabulário diferente no host:
`createNotificationRoutes({ module, scopes: { admin: ['admin'], service: ['robot'] } })`.

⚠️ Até a 0.5.x as rotas `admin`/`service` não declaravam escopo e **qualquer pessoa logada** editava
modelos e políticas. Ao atualizar, o `authResolver` precisa devolver `notification:admin` a quem
administra (ou o host passa `scopes`).

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

## Templates declarados pelo host (editor, padrão e restauração)

O host declara os templates no boot; o conteúdo editável continua versionado no banco (`templates`),
e a definição é só código — evoluir rótulo, descrição ou variáveis não exige migration.

```ts
const module = createNotificationModule({
  // ...
  config: {
    // ...
    templateDefinitions: [
      {
        key: 'welcome',
        channel: 'whatsapp',
        locale: 'pt-BR',
        label: 'Boas-vindas',
        description: 'Primeira mensagem da conversa',
        body: 'Olá {{name}}, bem-vindo!',
        variables: [{ name: 'name', description: 'Nome do contato', example: 'Maria', required: true }],
      },
    ],
  },
})
```

- **Sintaxe de variável: `{{campo}}`** (espaços toleráveis: `{{ campo }}`), só `[a-zA-Z0-9_]`. Campo ausente
  renderiza vazio. Não existe `{campo}` de chave simples — quem migra textos com essa forma troca para `{{campo}}`.
- As definições são validadas no boot (`InvalidTemplateDefinitionError`): identidade `key+channel+locale`
  duplicada, `label`/`body` vazio, variável repetida, ou texto padrão com variável não declarada. As
  variáveis entram no catálogo (`templateVariables` do host, para a mesma chave, prevalece).
- `useCases.ensureTemplateDefinitions.execute({ companyId })` — grava a v1 de cada definição **só se a
  identidade não tem nenhuma linha** (texto editado ou desativado nunca é sobrescrito). Idempotente e seguro
  em corrida (`23505` = "já existe"). Devolve as chaves criadas. Chame no boot/pré-deploy, por empresa.
- `useCases.listTemplateEditorItems.execute({ companyId })` — uma linha por definição (`TemplateEditorItem`:
  `label`, `description`, `variables`, `defaultBody`, `current`, `isCustomized`). Rota
  `GET /notification-template-definitions`.
- Editar: `useCases.upsertTemplate` (ou `POST /notification-templates`) grava versão nova, validando as variáveis.
- `useCases.restoreTemplateDefault.execute({ companyId, id })` — versão nova com o texto padrão da definição;
  o histórico fica. `POST /notification-templates/:id/restore-default` usa-o para toda chave declarada (o
  modelo padrão de e-mail segue pelo caminho próprio). Id desconhecido ou sem definição: 404.
- `useCases.renderTemplateText.execute({ companyId, key, channel, locale?, payload })` — texto pronto sem
  envio, para o host que transporta a mensagem por conta própria. Usa a versão ativa; sem ela, o padrão
  declarado (`source: 'default'`). Sem definição nem versão: `TemplateNotFoundError`.

## Licença

MIT © Ada Technology
