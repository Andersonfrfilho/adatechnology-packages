# Spec — Trio plugável `notification`

Capacidade **Notificações multicanal** (inbox in-app, push, e-mail, WhatsApp, SMS) como
módulo plugável **com baterias inclusas**: importar o pacote entrega rotas, worker, cron,
seeds e dublês de teste prontos — não só use-cases soltos.

Regra de referência: `~/.claude/rules/rules/packages/pluggable-module.md`.
Companheiras: `.specs/features/meta-whatsapp-trio/spec.md` (o canal WhatsApp vem de lá,
não é reimplementado) · `.specs/features/meta-catalog-trio/spec.md` (mesmo padrão de porta
opcional entre capacidades).

> **Status:** 🚧 Spec para revisão · Criada em 2026-08-01 · revisada com as decisões do
> usuário (NestJS abandonado · `domestic` fora de escopo · rotas prontas são requisito)

---

## 1. Por que existe (regra do 2º uso — satisfeita com folga)

A capacidade **já foi escrita cinco vezes** no ecossistema, e cada cópia divergiu:

| Produto | O que já tem | Canal |
|---|---|---|
| `quickcart` (`worker-quickcart`) | `ProcessNotificationJob.use-case` + guarda de idempotência por `jobId` + `NotificationMessages.constant` | WhatsApp |
| `micro-backend-uws` (template) | `modules/notification/**` com router próprio | inbox |
| `micro-backend-api` | 7 use-cases + controller + DTOs + error factory | inbox |
| `financiamento-imobiliario-bot` | `infra/email/NodemailerEmailProvider.ts` | e-mail |
| `cawme` | `expo-notifications@~55` **instalado e nunca usado** | push (pendente) |

Some-se `backend-api`, `backend-cron` e `micro-backend-worker` com o mesmo
`modules/notification` copiado. É o antipadrão "copy-paste com melhorias locais" da §6 da
regra no estado puro.

**Decisão módulo × gateway** (tabela §1 da regra): cada produto tem credencial própria
(número WhatsApp, remetente SMTP, projeto Firebase), todos os consumidores estão na stack
Bun/TS, e nenhum produto quer mais um deploy. → **módulo plugável.**

---

## 2. O requisito que define esta spec: baterias inclusas

O `meta-whatsapp-module` entrega use-cases e nada de HTTP. O custo disso está medido no
quickcart:

| Arquivo escrito à mão no produto | Linhas |
|---|---|
| `modules/conversation/infra/http/Conversation.controller.ts` | 622 |
| `ConversationSettings.controller.ts` | 204 |
| `ConversationStream.controller.ts` (SSE) | 111 |
| `PreviewMedia.controller.ts` | 99 |
| `ConversationRoutes.ts` | 86 |
| `PreviewTranscript.controller.ts` | 80 |
| `UnmatchedDemand.controller.ts` | 65 |
| **Total de cola HTTP** | **1.353** |

Nada disso é regra de negócio do quickcart — é tradução entre o use-case do pacote e o
`Bun.serve`. O próximo produto reescreveria as mesmas 1.353 linhas, com divergências.

**Requisito, então:** `createNotificationModule(...)` devolve, além dos use-cases:

1. **Rotas HTTP montáveis** em uma linha, com validação, envelope, paginação e
   autorização por objeto já dentro.
2. **Stream SSE** do inbox (badge em tempo real) pronto.
3. **Worker de fila** pronto, com adaptador para **BullMQ** (quickcart) e **AMQP**
   (template `micro-backend-uws`).
4. **Descritores de cron** para agendados, digest e purga.
5. **Paths OpenAPI** derivados da mesma tabela de rotas, para o host fazer merge no
   Swagger que ele já tem.
6. **Seeds de template** default em pt-BR.
7. **Dublês de teste** (`/testing`) — drivers em memória, sem rede.

Baterias inclusas **não é** regra de negócio inclusa: o módulo nunca decide *quando*
notificar (§3.2).

---

## 3. Escopo

### 3.1 GENÉRICO → `notification-*`

| Área | Evidência de origem |
|---|---|
| Inbox: criar, listar paginado, contador de não lidas, marcar lida, marcar todas, excluir | `micro-backend-api/src/modules/notification/use-cases/**` |
| Rotas HTTP + SSE + OpenAPI dessas operações | §2 (1.353 linhas de cola no quickcart) |
| Registro de dispositivo (token push) e invalidação do token morto | `cawme` (expo-notifications), 4 `package.json` com `firebase-admin` |
| Envio multicanal com fan-out por preferência | novo |
| Templates versionados por empresa, com locale | `quickcart/.../NotificationMessages.constant.ts` (hardcoded) |
| Idempotência e dedupe | `ProcessNotificationJob.use-case.ts:46` (`notification:processed:${jobId}`) |
| Fila, retry com backoff, DLQ | `quickcart/apps/worker-quickcart/src/infra/queue/workers.ts` (BullMQ) |
| Log de entrega por tentativa (status, id do provedor, código de erro) | novo |
| Preferências por categoria/canal, quiet hours, supressão (bounce/opt-out) | novo — LGPD e deliverability |
| Agendamento (`scheduledFor`) | novo |
| Webhook de recibo de entrega | novo |
| Telas: sino, lista, preferências, CRUD de template | novo |

### 3.2 FICA NO PRODUTO

- **Quando** notificar — o gatilho é regra de negócio ("pedido saiu para entrega").
- **Conteúdo** dos templates e curadoria das categorias.
- Tabela de usuários/clientes: o módulo **não conhece** e nunca lê (§6.2).
- Validação de token/sessão: o módulo recebe a identidade já resolvida (§6.1).

---

## 4. Anatomia

```text
packages/backend/
├── notification-contracts/   @adatechnology/notification-contracts   (zod, DTOs, eventos, portas)
├── notification-module/      @adatechnology/notification-module      (schema, migrations, use-cases, http, worker)
├── push-provider/            @adatechnology/push-provider            (SDK stateless: Expo + FCM)
└── email-provider/           @adatechnology/email-provider           (SDK stateless: SMTP + Resend + SES)
packages/frontend/
├── notification-client/      @adatechnology/notification-client      (isomórfico: API + registro de token)
└── notification-ui/          @adatechnology/notification-ui          (React web: headless + telas)
```

`pgSchema('notification')`, journal `notification_migrations` (§3 da regra).

**Entrypoints do `notification-module`** — o que não é importado não é instalado:

| Entrypoint | Traz | Peer dep |
|---|---|---|
| `.` | use-cases, schema, migrations, `createNotificationModule` | `drizzle-orm` |
| `./http/fetch` | router WHATWG (`Bun.serve`, quickcart, Hono) | — |
| `./http/uws` | `mountNotificationRoutes({ app })` para uWebSockets.js | `uWebSockets.js` |
| `./queue/bullmq` | adaptador de `QueuePort` | `bullmq`, `ioredis` |
| `./queue/amqp` | adaptador de `QueuePort` | `amqplib` |
| `./openapi` | paths OpenAPI derivados da tabela de rotas | — |
| `./testing` | drivers em memória, harness, factories | — |

### 4.1 Por que dois pacotes de provider, e não drivers dentro do módulo

Simetria já estabelecida (`meta-whatsapp-provider`, `fiscal-provider`,
`object-storage-provider`): **provider = SDK stateless; module = stateful com
Drizzle/rotas/migrations**. Retorno concreto: quem só quer inbox não instala
`firebase-admin` (~40 MB) nem `nodemailer`; o `financiamento-imobiliario-bot` usa
`email-provider` sozinho, sem banco. As fábricas seguem `createFiscalProvider({ model })`.

### 4.2 Por que dois pacotes no frontend

`cawme` é React Native: não importa pacote com `react-dom`, Tailwind e CSS. O registro de
token é a mesma lógica nos dois mundos. Precedente do monorepo:
`@adatechnology/logger-client` é isomórfico, `conversations-ui` é web.

- `notification-client` — isomórfico, sem DOM: cliente HTTP tipado, registro/renovação de
  token, hooks headless.
- `notification-ui` — web: importa o `-client` e entrega sino, lista, preferências, admin
  de template.

### 4.3 O canal WhatsApp **não** é reimplementado

`meta-whatsapp-provider` já envia texto e template. O `notification-module` declara a
porta e **não importa** o pacote de WhatsApp (granularidade, §2 da regra). O contracts
exporta um adaptador *duck-typed* sobre a forma que o provider já satisfaz:

```ts
// contracts — zero dependência de Meta
export function createWhatsAppDriverFromChannel(channel: {
  sendText(to: string, body: string): Promise<{ externalMessageId: string | null }>
  sendTemplate(params: SendTemplateParams): Promise<{ externalMessageId: string | null }>
}): WhatsAppDriverPort
```

O quickcart costura em 3 linhas, com o `whatsapp.channel` que ele já tem
(`modules/webhook/infra/whatsapp/metaWhatsAppModule.ts:102`).

---

## 5. Modelo de dados — `pgSchema('notification')`

`varchar` em vez de ENUM nativo (§8 do `code-standart.md`), `companyId` em toda entidade
vindo do contexto autenticado (`database.md`), PK UUID.

| Tabela | Colunas relevantes | Índices |
|---|---|---|
| `templates` | `companyId`, `key`, `channel`, `locale`, `version`, `subject`, `body`, `whatsappTemplateName`, `active` | uniq `(companyId, key, channel, locale, version)` |
| `notifications` | `companyId`, `recipientUserId`, `category`, `templateKey`, `payload` jsonb, `title`, `body`, `dedupeKey`, `scheduledFor`, `status`, `readAt`, `createdAt` | uniq parcial `(companyId, dedupeKey)` where not null · `(companyId, recipientUserId, readAt)` · `(status, scheduledFor)` |
| `deliveries` | `notificationId`, `channel`, `driver`, `targetMasked`, `status`, `attempt`, `providerMessageId`, `errorCode`, `sentAt`, `deliveredAt`, `failedAt` | `(notificationId)` · `(companyId, status, createdAt)` |
| `devices` | `companyId`, `userId`, `platform` (ios/android/web), `driver` (expo/fcm), `token`, `appVersion`, `locale`, `timezone`, `lastSeenAt`, `disabledAt`, `disabledReason` | uniq `(driver, token)` · `(companyId, userId, disabledAt)` |
| `preferences` | `companyId`, `userId`, `category`, `channel`, `enabled`, `quietHoursStart`, `quietHoursEnd`, `timezone` | uniq `(companyId, userId, category, channel)` |
| `suppressions` | `companyId`, `channel`, `targetHash`, `reason` (bounce/complaint/opt-out), `expiresAt` | uniq `(companyId, channel, targetHash)` |

**Privacidade (LGPD · `security.md` §1 e §5):**

- `deliveries.targetMasked` guarda `****1234` / `a***@dominio.com`. O endereço real **não
  é persistido pelo módulo** — vem da porta de destinatário no instante do envio.
- `suppressions.targetHash` é HMAC do endereço com chave injetada: confere supressão sem
  armazenar o dado.
- Job na fila carrega **`notificationId`**, nunca conteúdo nem endereço (`worker.md`).
- `PurgeExpiredNotificationsUseCase` com retenção configurável (default 180 dias).

**Estados:** `notifications.status` = `pending → scheduled → queued → dispatched →
(partially_failed | failed)`; `deliveries.status` = `queued → sent → delivered | failed |
bounced`. `read` vive em `readAt`, não no status — inbox lida não muda resultado de envio.

---

## 6. Portas — as únicas formas de extensão

### 6.1 `AuthContextResolverPort` — obrigatória para as rotas

```ts
interface AuthContextResolverPort {
  // Recebe os headers da requisição já normalizados; devolve identidade JÁ VALIDADA pelo host.
  resolve(params: { headers: Readonly<Record<string, string>> }): Promise<
    { readonly companyId: string; readonly userId?: string; readonly scopes: readonly string[] } | undefined
  >
}
```

O módulo **não valida token**: quem emite a sessão é o host (`security.md` §2). Ele só
recebe `{ companyId, userId, scopes }` e aplica autorização **por objeto** — inbox filtra
sempre por `companyId` + `recipientUserId` do contexto, nunca por id vindo do cliente
(BOLA/API1). Sem resolver injetado e com rotas ligadas, **falha no boot**.

### 6.2 `RecipientResolverPort` — obrigatória

```ts
interface RecipientResolverPort {
  resolve(params: { userId: string; companyId: string }): Promise<{
    readonly email?: string
    readonly phone?: string
    readonly locale?: string
    readonly timezone?: string
    readonly displayName?: string
  } | undefined>
}
```

Espelha `SubjectResolverInterface` do `meta-whatsapp-module`. É o que permite ao módulo
não conhecer a tabela de usuários do produto **e** não duplicar PII.

### 6.3 Drivers de canal

```ts
type DeliveryAttemptResult =
  | { readonly outcome: 'sent'; readonly providerMessageId?: string }
  | { readonly outcome: 'invalid_target'; readonly errorCode: string }   // desativa device / suprime
  | { readonly outcome: 'retriable'; readonly errorCode: string; readonly retryAfterSeconds?: number }
  | { readonly outcome: 'permanent'; readonly errorCode: string }
```

A classificação é do driver, não do módulo: só o driver sabe que `DeviceNotRegistered`
(Expo) e `registration-token-not-registered` (FCM) significam "apaga o token", e que
`429`/`5xx` significa "tenta de novo". O módulo age sobre o `outcome` — é o que evita
retry infinito em erro permanente e token morto vivo para sempre.

### 6.4 Demais portas

| Porta | Obrigatória | Default no pacote | Para quê |
|---|---|---|---|
| `QueuePort` | não | `InProcessQueue` (dev) | adaptadores prontos: `./queue/bullmq`, `./queue/amqp` |
| `TemplateRendererPort` | não | interpolação `{{campo}}` + escape por canal | Handlebars/MJML do host |
| `CachePort` | não | — (throttle e dedupe curto off) | Redis do host |
| `RealtimeNotifierPort` | não | — (badge só no polling) | o SSE do módulo já usa esta porta |
| `ClockPort` | não | `Date` | testes determinísticos de quiet hours |
| `LoggerPort` | não | no-op | logger do host (traceId/traceStack) |
| `MetricsPort` | não | no-op | contadores Prometheus do host |

### 6.5 Eventos de domínio (hooks do produto)

`notification.created` · `notification.dispatched` · `delivery.sent` · `delivery.failed` ·
`delivery.bounced` · `notification.read` · `device.registered` · `device.invalidated` ·
`preferences.updated` — payload tipado no contracts. É onde o produto pluga regra própria
(bounce marca contato inválido no CRM) sem tocar o módulo.

---

## 7. Superfície HTTP pronta

### 7.1 Contrato normalizado, adaptadores finos

A tabela de rotas é **declarativa e sem tipo de framework**:

```ts
type NotificationRoute = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly path: string                       // '/notifications/:id/read'
  readonly scope: 'user' | 'admin' | 'service' | 'public'
  readonly bodySchema?: ZodSchema
  readonly querySchema?: ZodSchema
  readonly handler: (context: NotificationRequestContext) => Promise<NotificationHttpResult>
}
```

Dela saem três coisas sem duplicação: os adaptadores, os paths OpenAPI e os testes de
contrato. Adaptadores publicados:

| Entrypoint | Uso |
|---|---|
| `./http/fetch` | `const http = createNotificationFetchRouter({ basePath: '/v1', authResolver })` → `http.match(request)` / `http.handle(request)`. Serve `Bun.serve` direto, o `Router` do quickcart e Hono |
| `./http/uws` | `mountNotificationRoutes({ app, basePath: '/v1', authResolver })` — trata `res.cork()`, `onAborted` e leitura de `rawBody` para HMAC, do jeito que o template `micro-backend-uws` já faz |

> **Nota de regra:** `code-standart.md` §2 pede `Bun.serve` e proíbe o addon
> `uWebSockets.js` em app Bun; o template atual usa o addon. O SDK atende aos dois porque
> o parque tem os dois — a convergência é decisão de plataforma, não deste pacote.

### 7.2 Rotas

| Método | Rota | Escopo | Observação |
|---|---|---|---|
| `POST` | `/notifications` | service/admin | aceita `Idempotency-Key`; `201` novo, `200` idempotente |
| `GET` | `/notifications` | user | inbox do próprio usuário; filtros `category`, `read`; cursor |
| `GET` | `/notifications/unread-count` | user | |
| `GET` | `/notifications/stream` | user | **SSE**: badge em tempo real, heartbeat 25 s |
| `PATCH` | `/notifications/:id/read` | user | valida propriedade do objeto |
| `POST` | `/notifications/read-all` | user | |
| `DELETE` | `/notifications/:id` | user | soft delete |
| `POST` | `/notification-devices` | user | idempotente por `(driver, token)` |
| `DELETE` | `/notification-devices/:id` | user | |
| `GET`/`PUT` | `/notification-preferences` | user | |
| `GET`/`POST`/`PUT` | `/notification-templates` | admin | por empresa |
| `POST` | `/notification-webhooks/:driver` | public + HMAC | recibo de entrega: assinatura sobre `rawBody`, janela de timestamp, nonce; **fail-closed** sem segredo |

Envelope `{ data }` / `{ data, pagination }` / `{ error: { code, message } }`, `perPage`
limitado a 100, status codes conforme `apis.md`. Erro de domínio é mapeado por um filtro
único do pacote — o host não escreve `try/catch` por rota (§7 do `code-standart.md`).

**Lição do quickcart já embutida:** o SSE escreve heartbeat a cada 25 s, então o
`idleTimeout` do `Bun.serve` precisa ser maior (o quickcart perdeu stream por causa disso
— `index.ts:48`). O README traz o valor e o adaptador expõe `heartbeatSeconds`.

---

## 8. Como o quickcart configura (host de referência)

### 8.1 Composição — `infra/container.ts`

```ts
import { createNotificationModule, runNotificationMigrations } from '@adatechnology/notification-module'
import { createBullMqQueue } from '@adatechnology/notification-module/queue/bullmq'
import { createWhatsAppDriverFromChannel } from '@adatechnology/notification-contracts'
import { createPushProvider } from '@adatechnology/push-provider'
import { createEmailProvider } from '@adatechnology/email-provider'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runNotificationMigrations({ db, migrate })   // journal próprio, append-only

export const notification = createNotificationModule({
  db,                                    // Drizzle do host — o módulo não abre conexão
  config: {
    defaultLocale: 'pt-BR',
    defaultTimezone: 'America/Sao_Paulo',
    retentionDays: 180,
    retry: { attempts: 5, backoffSeconds: 30 },
    suppressionHmacKey: environment.NOTIFICATION_SUPPRESSION_KEY,
    webhookSecret: environment.NOTIFICATION_WEBHOOK_SECRET,
  },
  features: { inbox: true, push: true, email: true, whatsapp: true, sms: false, scheduling: true, quietHours: true, webhooks: true },
  providers: {
    authContextResolver,                                     // OBRIGATÓRIA — sessão do host
    recipientResolver,                                       // OBRIGATÓRIA — tabela de clientes do host
    channels: {
      whatsapp: createWhatsAppDriverFromChannel(whatsapp.channel),   // meta-whatsapp-module já instanciado
      push: createPushProvider({ driver: 'fcm', serviceAccountJson: environment.FIREBASE_SERVICE_ACCOUNT_JSON }),
      email: createEmailProvider({ driver: 'resend', apiKey: environment.RESEND_API_KEY, from: environment.MAIL_FROM }),
    },
    queue: createBullMqQueue({ connection: redis, queueName: `${environment.PROJECT_NAME}-notification` }),
    cache: redisCacheAdapter,
    logger: logger.child('Notification'),
  },
  hooks: {
    onDeliveryBounced: ({ notificationId, channel }) => markContactInvalid.execute({ notificationId, channel }),
  },
})
```

### 8.2 Rotas — `infra/http/server.ts` (uma linha)

```ts
import { createNotificationFetchRouter } from '@adatechnology/notification-module/http/fetch'

const notificationHttp = createNotificationFetchRouter({
  basePath: '/v1',
  module: notification,
  heartbeatSeconds: 25,
})

router.mount(notificationHttp)     // ← substitui as ~1.353 linhas do modelo atual
```

`router.mount()` é o único ponto que o `Router` do quickcart precisa ganhar (~20 linhas,
uma vez): delega ao `match`/`handle` do pacote antes do `registerNotFoundHandler`.

### 8.3 Envio pelo produto

```ts
await notification.useCases.sendNotification.execute({
  companyId,
  recipientUserId: userId,
  category: 'order_status',
  templateKey: 'order.out_for_delivery',
  payload: { shortCode: order.shortCode, eta: '18:40' },
  dedupeKey: `order:${order.id}:out_for_delivery`,   // substitui a guarda por jobId
  channels: ['inbox', 'push', 'whatsapp'],           // opcional — sem isso resolve por preferência
})
```

### 8.4 Worker e cron

```ts
// worker-quickcart — soma ao workers.ts existente
createNotificationWorker({ module: notification, concurrency: 8 }).start()

// cron: os descritores vêm do pacote, o host só registra
for (const schedule of notification.schedules) {
  cron.register(schedule.name, schedule.cronExpression, schedule.run)
}
// dispatch-due (*/1 min) · purge-expired (diário) · retry-stuck (*/5 min)
```

### 8.5 Documentação e observabilidade de graça

```ts
import { notificationOpenApiPaths } from '@adatechnology/notification-module/openapi'
const spec = buildOpenApiSpec({ extraPaths: notificationOpenApiPaths({ basePath: '/v1' }) })
```

`MetricsPort` injetada alimenta os contadores do host
(`notification_sent_total{channel,status}`, `notification_queue_lag_seconds`).

### 8.6 Variáveis de ambiente (validadas no boot, `nodejs.md`)

| Variável | Nota |
|---|---|
| `NOTIFICATION_SUPPRESSION_KEY` | HMAC de supressão; boot falha com `features.email` ligado sem ela |
| `NOTIFICATION_WEBHOOK_SECRET` | fail-closed: ausente, a rota de recibo não sobe |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | segredo — nunca em log |
| `EXPO_ACCESS_TOKEN` | quando o driver for Expo |
| `RESEND_API_KEY` ou `SMTP_URL` | `SMTP_URL` aponta para Mailpit em dev |
| `MAIL_FROM`, `MAIL_REPLY_TO` | |

Nenhuma delas é lida dentro dos pacotes (§ "Configuração 100% injetada"). Prefixo
`VITE_*`/`EXPO_PUBLIC_*` só para valor público (`security.md` §4).

### 8.7 Infra local

- `docker-compose.yml` da raiz ganha **Mailpit** (`1025` SMTP / `8025` UI): e-mail de dev
  não sai da máquina e é inspecionável.
- `Makefile`: `notification-migrate`, `notification-worker`, `mail-ui`, com prefixo
  `$(PROJECT_NAME)-$(ENV)-` (§4 do `code-standart.md`).
- `seedDefaultTemplates()` roda os use-cases do módulo (nunca `INSERT` bruto — §5).

### 8.8 Frontend do quickcart (PWA)

```tsx
<NotificationProvider client={notificationClient} queryClient={queryClient} theme={appTheme} locale="pt-BR">
  <NotificationBell />
</NotificationProvider>
```

Gotchas já pagos na migração do `conversations-ui` e que entram no README: incluir
`./node_modules/@adatechnology/notification-ui/dist/**/*.js` no `content` do Tailwind,
`darkMode: 'class'`, importar `styles.css`, e excluir o pacote do pre-bundle do Vite
quando linkado por `file:`. O `frontend-web` já é PWA (`vite-plugin-pwa`), então **web
push via FCM valida o canal push sem depender do app mobile**.

---

## 9. Consumidores

| Ordem | Produto | O que ganha |
|---|---|---|
| **1 (v1)** | `quickcart` (api + worker + frontend-web) | troca `ProcessNotificationJob` e a guarda por `jobId` pelo módulo; ganha inbox, SSE, push web e log de entrega |
| 2 | `financiamento-imobiliario-bot` | `NodemailerEmailProvider` → `email-provider`; ganha log de entrega e supressão de bounce |
| 3 | `sakura-bot-oficial` | notificação de fiscal/entrega, hoje inexistente |
| 4 | `micro-backend-uws` (template) | o `modules/notification` do template passa a ser o adaptador `./http/uws`, e todo projeto novo nasce com notificação |
| — | `domestic-*` | **fora de escopo por decisão do usuário.** Nada é tocado; não entra em nenhuma task |
| — | `cawme` | push mobile fica para quando o backend dele entrar em escopo. O driver Expo é publicado e validado por teste de integração com token real do Expo Go |

---

## 10. Regras de negócio genéricas (do módulo)

1. **Fan-out por preferência.** Sem `channels` explícito, resolve pela `preferences`;
   canal desligado é `skipped` **com registro** — não silêncio.
2. **Inbox é sempre gravado** quando resolvido, mesmo que push falhe: histórico não
   depende de provedor externo.
3. **Idempotência.** `Idempotency-Key` na rota e `dedupeKey` no use-case; repetição
   devolve `200` com a notificação existente.
4. **Quiet hours.** Fora da janela, canais intrusivos (push/SMS/WhatsApp) são reagendados
   para o próximo horário permitido no timezone do destinatário; inbox e e-mail passam.
5. **Supressão.** Endereço suprimido nunca é tentado; `delivery` nasce `failed` com
   `errorCode: 'suppressed'`.
6. **Retry** só em `outcome: 'retriable'`, backoff exponencial + jitter até `attempts`
   (default 5). Estouro → `failed` + evento.
7. **WhatsApp fora da janela de 24 h** exige template aprovado: sem
   `template.whatsappTemplateName`, canal `skipped` com
   `errorCode: 'whatsapp_template_required'`.
8. **Throttle por destinatário** (default 10 push/hora) com `CachePort`; sem cache, off e
   documentado.
9. **Trilha de auditoria** de ação sensível (envio, alteração de preferência, registro de
   device) com ator, alvo, IP e timestamp (`security.md` §10).

---

## 11. Lacunas e limites deliberados

- **SMS sem driver.** Zero consumidores. A porta é declarada (~20 linhas), nenhum driver é
  publicado — extrair antes do 1º uso é abstração prematura (§6 da regra). Canal ligado
  sem driver falha **no boot**, com mensagem explícita.
- **Sem digest agregado na v1.** `scheduling` cobre "manda às 9h"; agregar "as 12 de hoje
  em uma" fica para v2.
- **Sem editor visual de template.** O `-ui` entrega CRUD; WYSIWYG/MJML é v2.
- **`delivered` é assimétrico.** Expo e FCM confirmam aceite, não entrega no aparelho;
  entrega real só existe em e-mail (webhook) e WhatsApp (status). O contracts documenta a
  assimetria em vez de fingir paridade.
- **Sem adaptador NestJS.** NestJS foi abandonado no ecossistema; os adaptadores são
  `fetch` (Bun.serve) e `uws`.

---

## 12. Decisões

**✅ Q1 — RESOLVIDA.** `domestic-*` e os demais produtos em TypeORM/Mongo **não entram**.
Nenhuma migração de inbox legado nesta spec.

**✅ Q3 — RESOLVIDA.** O pacote **entrega as rotas prontas** (§7), com adaptadores `fetch`
e `uws`, mais SSE, OpenAPI, worker, cron, seeds e testing. É o requisito central (§2).

**✅ Q5 — RESOLVIDA.** O trio nasce no `adatechnology-packages`, com o quickcart como
primeiro consumidor migrado. Não há o que extrair — há o que generalizar.

**✅ Q2 — RESOLVIDA.** `category` é **string livre** (`varchar`), registrada por empresa em
`templates`. Categoria é vocabulário de negócio ("order_status", "installment_due");
fechar num enum do contracts obrigaria uma major a cada produto novo. O contracts exporta
`NOTIFICATION_CATEGORY_HINT` apenas como sugestão de nomenclatura, sem valor normativo.

**✅ Q4 — RESOLVIDA.** Precedência do `timezone` do destinatário, nesta ordem:
`preferences.timezone` (escolha explícita) → `RecipientResolverPort.timezone` →
`devices.timezone` do device ativo mais recente → `config.defaultTimezone`. O device é só
fallback: usuário viajando divergiria da preferência real. Implementado em
`resolveRecipientTimezone()`, com teste por nível da cadeia.

---

## 13. Critérios de aceite

- [ ] Seis pacotes publicados com semver + changeset
- [ ] `pgSchema('notification')` + journal `notification_migrations`, migrations
      append-only
- [ ] **Zero `process.env`** dentro de qualquer pacote
- [ ] Zero import de `meta-whatsapp-*` no `notification-module`
- [ ] Módulo funciona com **apenas** `inbox` ligado — sem SDK de push/e-mail instalado
- [ ] **Montar as rotas no quickcart custa ≤ 25 linhas** de cola, contra as 1.353 atuais
      do modelo `conversation` (métrica de aceite do requisito da §2)
- [ ] Adaptadores `fetch` e `uws` cobrindo a mesma tabela de rotas, com teste de contrato
      compartilhado entre os dois
- [ ] `AuthContextResolverPort` obrigatória com rotas ligadas; nenhuma validação de token
      dentro do pacote; teste de BOLA (usuário A não lê inbox de B)
- [ ] `RecipientResolverPort` é a única via de acesso a e-mail/telefone; nenhuma coluna do
      módulo persiste endereço em claro
- [ ] Nenhum log com PII em nenhum nível, inclusive `debug` (teste de auditoria no CI)
- [ ] Job na fila carrega `notificationId`, nunca conteúdo
- [ ] Idempotência provada por teste: mesmo `dedupeKey` duas vezes = uma entrega
- [ ] `invalid_target` desativa device / cria supressão, sem retry
- [ ] SSE com heartbeat documentado e teste de reconexão
- [ ] Paths OpenAPI derivados da tabela de rotas (sem duplicação manual)
- [ ] Adaptadores de fila BullMQ e AMQP com teste de integração
- [ ] `./testing` com drivers em memória; suíte do módulo roda sem rede
- [ ] Camada headless do frontend exportada independente das telas, consumível em RN
- [ ] Webhook de recibo com HMAC sobre `rawBody`, janela de timestamp e nonce; fail-closed
- [ ] Nenhuma regra de negócio de produto dentro dos pacotes
- [ ] README de cada pacote: instalação, `create…`, portas, exemplo de host, gotchas
- [ ] `quickcart` em produção sobre o SDK, sem regressão no fluxo de status de pedido
- [ ] Revisão final com `opus` antes de publicar (§7 da regra)

---

## 14. Modelos por etapa (`model-economy.md`)

| Etapa | Modelo |
|---|---|
| Desenho de portas, contratos, tabela de rotas (esta spec) | `opus`/`fable` 🧠 |
| `notification-contracts` | `haiku` |
| `notification-module` — dados, use-cases, HTTP, adaptadores | `sonnet` |
| `push-provider` / `email-provider` | `sonnet` |
| `notification-client` / `notification-ui` | `sonnet` |
| Migração do quickcart | `sonnet` |
| Renames, bumps, changelogs, locales | `haiku` |
| **Gate de publicação** | **`opus`** obrigatório |
