# NOTIF — Tasks

Spec: `.specs/features/notification-trio/spec.md`
Gate obrigatório ao fim de **cada** task: `pnpm --filter=<pacote> exec tsc --noEmit` +
testes do pacote + commit isolado (`model-economy.md` §3).
Host de referência: **quickcart**. `domestic-*` está fora de escopo e não aparece em
nenhuma task. Nenhum adaptador NestJS.

Decisões fechadas: Q1 (legado fora), Q2 (`category` string livre), Q3 (rotas prontas),
Q4 (precedência do timezone), Q5 (nasce no monorepo).

---

## Fase 0 — Decisões e ADR ✅
> 🤖 Modelo: `opus` 🧠

- ✅ **T0.1** Q2 e Q4 fechadas na §12 da spec. `category` é `varchar` livre com
      `NOTIFICATION_CATEGORY_HINT` só como sugestão; timezone resolve na ordem
      preferência → resolver → device → default.
- ✅ **T0.2** ADR em `docs/adr/0001-notification-trio.md`: módulo × gateway, separação
      provider/module, e a tabela de rotas declarativa como fonte única de adaptadores +
      OpenAPI + testes de contrato (com a métrica de ≤ 25 linhas de cola).
- ✅ **T0.3** Conflito de plataforma registrado na §4 do ADR: `code-standart.md` §2 pede
      `Bun.serve` e proíbe o addon `uWebSockets.js`, e o template `micro-backend-uws` usa
      o addon. O SDK atende aos dois; convergir é decisão de plataforma, pendente.

---

## Fase 1 — `notification-contracts` ✅
> 🤖 Modelo: `haiku` (T1.4 e T1.5 são 🧠 — validar com `opus`)

- ✅ **T1.1** Pacote `packages/backend/notification-contracts` criado (package.json
      `0.1.0-rc.0`, tsconfig, tsup, CHANGELOG, .gitignore) espelhando
      `meta-whatsapp-contracts`. `pnpm install` rodado; `tsc --noEmit` limpo.
- ✅ **T1.2** `notification.types.ts` — canais, status, plataformas, drivers e
      supressão como `const` object + `as const`; entidades (`NotificationSummary`,
      `DeliverySummary`, `DeviceRegistration`, `NotificationPreference`,
      `NotificationTemplate`) e params/result de envio e listagem.
- ✅ **T1.3** Schemas zod de fronteira: `SendNotificationSchema`, `RegisterDeviceSchema`,
      `UpdatePreferencesSchema`, `UpsertTemplateSchema`, `ListNotificationsQuerySchema`,
      `DeliveryWebhookSchema`. Tipos derivados com sufixo `Body`/`Query` (os
      `Params`/`Result` de use-case vivem em `notification.types.ts`). Nenhum schema
      aceita `companyId` — teste em `strictness.test.ts` garante.
- ✅ **T1.4** 🧠 Portas escritas em **dois** arquivos, para respeitar o limite de 200
      linhas por arquivo (§ "File Organization"): `channelDrivers.ts`
      (`DeliveryAttemptResult` + `Push`/`Email`/`WhatsApp`/`Sms` `DriverPort` + params de
      envio) e `providers.ts` (`AuthContextResolverPort`, `RecipientResolverPort`,
      `QueuePort`, `TemplateRendererPort`, `CachePort`, `RealtimeNotifierPort`,
      `ClockPort`, `LoggerPort`, `MetricsPort`). Cada porta com o **porquê** documentado.
- ✅ **T1.5** 🧠 `http.types.ts` — `NotificationRoute`, `NotificationRouteTable`,
      `NotificationRequestContext` (com `rawBody` preservado para HMAC),
      `NotificationHttpResult` (`json` | `empty` | `stream`) e `NotificationStreamResult`
      com `heartbeatSeconds` no contrato. Zero tipo de framework no arquivo.
- ✅ **T1.6** `events.ts` — os 9 eventos da §6.5 com payload tipado.
- ✅ **T1.7** `errors.ts` — hierarquia **autocontida** (pacote publicado não importa o
      `DomainError` do host): `NotificationError extends Error` com
      `statusCode`/`code`/`details`, mapa `NOTIFICATION_ERROR_CODES` e subclasses
      (`TemplateNotFoundError`, `ChannelNotConfiguredError`, `RecipientUnresolvedError`,
      `SuppressedTargetError`, `NotificationNotFoundError`,
      `InvalidWebhookSignatureError`). Molde: `meta-whatsapp-contracts/src/errors.ts`.
- ✅ **T1.8** `createWhatsAppDriverFromChannel()` — adaptador duck-typed, **zero**
      dependência de Meta (§4.3).
- ✅ **T1.9** `index.ts` exportando tudo (tipos com `export type`) +
      `strictness.test.ts` no molde do contracts de WhatsApp: nenhum tipo público vaza
      `any`.
- ✅ **T1.10** `CLAUDE.md` do pacote no formato dos vizinhos (propósito, uso, portas).

**Aceite:** `tsc --noEmit` limpo; `index.ts` exporta tudo; nenhuma dependência de runtime
além de `zod`.

---

## Fase 2 — Drivers (SDKs stateless) ✅
> 🤖 Modelo: `sonnet`

- ✅ **T2.1** `packages/backend/push-provider`: `ExpoPushProvider` — `sendExpoPushBatch`
      fragmenta em lotes de 100 e despacha em paralelo (`Promise.all`, sem `await` em
      loop); `send()` é o wrapper de lote-de-1 que satisfaz `PushDriverPort`.
      `DeviceNotRegistered` → `invalid_target`, `MessageRateExceeded` → `retriable`,
      `MessageTooBig`/`InvalidCredentials`/código novo → `permanent`, HTTP 429/5xx →
      `retriable`, demais 4xx → `permanent`.
- ✅ **T2.2** `FcmPushProvider` — `firebase-admin` como peer **opcional**, carregado por
      `import()` dinâmico só quando não há `messagingClient` injetado (quem só usa Expo
      não carrega o SDK). Suporta **web push** pelo mesmo `messaging().send()` — é o que
      valida o canal no PWA do quickcart sem app mobile.
      `registration-token-not-registered`/`invalid-registration-token` →
      `invalid_target`, `quota-exceeded`/`unavailable`/`internal-error` → `retriable`,
      `invalid-argument`/código novo → `permanent`.
- ✅ **T2.3** `createPushProvider({ driver })` — fábrica exaustiva no molde de
      `createFiscalProvider`, com `never` no default.
- ✅ **T2.4** `packages/backend/email-provider`: `SmtpEmailProvider` (`nodemailer` via
      `smtpUrl`, aponta para o Mailpit em dev), `ResendEmailProvider` (a Resend não lança
      em erro de negócio — `{ data, error }` — a classificação lê `error.name`/
      `statusCode`), `SesEmailProvider` (`@aws-sdk/client-sesv2` via `import()` dinâmico)
      + `createEmailProvider({ driver })` exaustivo. Nenhum driver expõe
      `invalid_target` síncrono — bounce de e-mail é assíncrono por natureza do
      protocolo (spec §11); SMTP é exceção parcial via `accepted`/`rejected` e código
      550/551/553.
- ✅ **T2.5** `parseResendWebhook` (`email.delivered`/`.bounced`/`.complained`, demais
      tipos → `undefined`) e `parseSesNotification` (dois `JSON.parse` em sequência:
      envelope SNS por fora, evento SES dentro de `Message`) devolvendo `DeliveryReceipt`
      do contracts.
- ✅ **T2.6** Testes unitários por driver e por parser com cliente/transporte dublê
      injetado — nenhum teste bate em SMTP, Resend, AWS ou Expo/FCM reais. Cabeçalho de
      copyright em todo arquivo (§17 do `code-standart.md`).

**Aceite:** cada provider instalável sozinho, sem o módulo; zero `process.env`; token e
segredo nunca aparecem em mensagem de erro. `firebase-admin`, `nodemailer`, `resend` e
`@aws-sdk/client-sesv2` são peer opcionais, carregados por `import()` dinâmico só quando o
driver real é usado sem cliente injetado.

---

## Fase 3 — `notification-module`: dados ✅
> 🤖 Modelo: `sonnet`

- ✅ **T3.1** Pacote + `database.types.ts` (`PgDatabase` genérico +
      `DrizzleMigrateFunction` injetado, como em `meta-whatsapp-module`). O `index.ts`
      exporta schema/migrations/repositories desta fase; os entrypoints `./http/*`,
      `./queue/*`, `./openapi` e `./testing` da §4 nascem nas Fases 4–5, junto com o que
      eles servem.
- ✅ **T3.2** `schema/schema.ts` — as 6 tabelas da §5 em `pgSchema('notification')`, com
      todos os índices. `varchar` em vez de ENUM; `companyId` em todas. `notifications`
      ganhou `deletedAt` (soft delete da Fase 4, ausente da tabela original da spec —
      lacuna fechada aqui, já que o schema é a hora certa de decidir a coluna).
- ✅ **T3.3** Migração gerada via `drizzle-kit generate` (revisada: schema + 6 tabelas +
      índices, incluindo o partial unique de `dedupeKey` renderizado corretamente) +
      `runNotificationMigrations` com journal `notification_migrations` fora do
      pgSchema.
- ✅ **T3.4** Repositories: `NotificationRepository`, `DeliveryRepository`,
      `DeviceRepository`, `PreferenceRepository`, `TemplateRepository`,
      `SuppressionRepository`. `PreferenceRepository.upsertMany` é um único
      `INSERT...ON CONFLICT DO UPDATE` com `excluded.*`, não upsert por linha em loop.
      `TemplateRepository.upsert` nunca sobrescreve — cada chamada cria a próxima
      versão. Exceção documentada: `DeliveryRepository.findByProviderMessage` não é
      escopado por `companyId` (webhook só tem o id do provedor; é essa busca que
      descobre a empresa).
- ✅ **T3.5** `repositories/isolation.test.ts` — toda condição de leitura/escrita
      alcançável por usuário é função pura exportada, renderizada com `PgDialect`
      (sem Postgres real, molde de `meta-whatsapp-module/SessionRepository.test.ts`):
      prova que `company_id` está em toda cláusula e que duas empresas nunca
      compartilham o parâmetro vinculado.

---

## Fase 4 — `notification-module`: comportamento ✅
> 🤖 Modelo: `sonnet` (T4.2 e T4.6 são 🧠)

> **Correções de schema feitas nesta fase** (duas migrações aditivas, ambas geradas pelo
> drizzle-kit do pacote): `0001` adiciona `deliveries.deviceId` — push tem uma entrega por
> aparelho, e sem essa coluna o dispatch não saberia qual token desativar em
> `invalid_target`; `0002` troca a FK `notification_id` para `ON DELETE cascade`, sem o
> que a purga por retenção violaria constraint. Também `NotificationJob` do contracts
> ganhou `deliveryId` (commit próprio) pelo mesmo motivo do `0001`.

- ✅ **T4.1** `createNotificationModule({ db, config, features, providers, hooks })` —
      valida config com zod próprio, checa feature × porta (ligar `email` sem driver, ou
      rotas sem `authContextResolver`, = erro **no boot**) e devolve
      `{ useCases, routes, worker, schedules, channel }`.
- ✅ **T4.2** 🧠 `SendNotification.use-case.ts` — template → destinatário →
      preferência/quiet hours/supressão/throttle → grava `notifications` + `deliveries`
      `queued` → enfileira `notificationId`. Idempotente por `dedupeKey` via unique
      parcial + tratamento de conflito (**não** read-then-write).
- ✅ **T4.3** `DispatchDelivery.use-case.ts` — consome job, chama o driver, age sobre o
      `DeliveryAttemptResult`: `sent` grava id do provedor; `invalid_target` desativa
      device / cria supressão; `retriable` reagenda com backoff+jitter até `attempts`;
      `permanent` finaliza. Nenhum try/catch só para relogar (§7 do `code-standart.md`).
- ✅ **T4.4** Inbox: `ListNotifications` (cursor), `CountUnread`, `MarkAsRead`,
      `MarkAllAsRead`, `DeleteNotification` — todos validando propriedade do objeto.
- ✅ **T4.5** Devices e preferências: `RegisterDevice` (idempotente por
      `(driver, token)`), `UnregisterDevice`, `GetPreferences`, `UpdatePreferences`.
- ✅ **T4.6** 🧠 `DispatchDueNotifications.use-case.ts` — agendados e reagendados por
      quiet hours, com `FOR UPDATE SKIP LOCKED` para múltiplas instâncias de cron não
      dispararem a mesma notificação.
- ✅ **T4.7** `ReceiveDeliveryReceipt.use-case.ts` + `webhookSecurity` (HMAC sobre
      `rawBody`, janela de timestamp, nonce via `CachePort`, fail-closed sem segredo),
      reaproveitando o desenho de `meta-whatsapp-module/channel/webhookSecurity.ts`.
- ✅ **T4.8** `PurgeExpiredNotifications.use-case.ts` (retenção configurável).
- ✅ **T4.9** `TemplateRenderer` default (`{{campo}}` + escape por canal) + CRUD de
      template por empresa + `seedDefaultTemplates()` rodando os use-cases (nunca `INSERT`
      bruto — §5 do `code-standart.md`).
- ✅ **T4.10** `InProcessQueue` default + emissão dos 9 eventos de domínio nos pontos
      corretos.
- ✅ **T4.11** Suite de comportamento: idempotência, fan-out por preferência, quiet hours
      em timezone com DST, token morto desativado sem retry, supressão respeitada, retry
      com backoff, inbox gravado mesmo com push falhando.
- ✅ **T4.12** Auditoria de PII: teste que exercita o logger do módulo e **falha** se
      e-mail, telefone ou corpo de mensagem aparecer em qualquer nível, inclusive `debug`.

---

## Fase 5 — HTTP, worker, cron e testing (as baterias) ✅
> 🤖 Modelo: `opus` (a spec pedia `sonnet`; o usuário trocou para opus durante a Fase 4 e
> mandou seguir — registrado aqui em vez de repetir a pergunta)

> **Lacuna fechada nesta fase:** `RealtimeNotifierPort` só tinha `publish`, e o SSE precisa
> **assinar** eventos. Ganhou `subscribe` opcional no contracts (commit próprio), com o
> custo de omiti-la documentado no contrato: sem ela o badge não cruza réplicas.
> `InProcessRealtimeNotifier` é o default, com esse limite explícito.

- ✅ **T5.1** 🧠 Tabela declarativa em três arquivos, pelo limite de 200 linhas:
      `http/inboxRoutes.ts` (6 rotas de inbox + SSE), `http/managementRoutes.ts` (7 de
      envio/devices/preferências/templates + webhook) e `http/routes.ts`
      (`createNotificationRoutes`, que compõe as duas e **omite a rota de webhook quando
      não há segredo** — fail-closed). São **13 rotas**, 14 com webhook habilitado; a §7.2
      da spec listava 15 porque contava `GET`/`PUT` de preferências e `GET`/`POST` de
      templates como linhas separadas do mesmo path.
- ✅ **T5.2** `http/errorFilter.ts` — mapa `NotificationError` → status + envelope
      `{ error: { code, message } }`; erro desconhecido vira 500 genérico, sem stack para
      o cliente (§7 do `code-standart.md`).
- ✅ **T5.3** `./http/fetch` — `createNotificationFetchRouter({ basePath, module,
      heartbeatSeconds })` com `match(request)` / `handle(request)`; SSE via
      `ReadableStream`. README documenta que o `idleTimeout` do `Bun.serve` precisa ser
      **maior** que o heartbeat (o quickcart perdeu stream por isso —
      `api-quickcart/src/index.ts:48`).
- ✅ **T5.4** `./http/uws` — `mountNotificationRoutes({ app, basePath, module })` com
      `res.cork()`, `onAborted` e leitura de `rawBody` para HMAC, no padrão do template
      `micro-backend-uws`.
- ✅ **T5.5** **Teste de contrato compartilhado**: a mesma bateria roda contra os dois
      adaptadores e exige respostas idênticas (status, envelope, headers). É o que impede
      os adaptadores de divergirem.
- ✅ **T5.6** Teste de autorização por objeto (BOLA) sobre as rotas **reais**: usuário A
      não lê, não marca como lida, não apaga e não alcança por `read-all` a notificação de
      B — e o mesmo usuário autenticado em outro tenant também não. Sempre 404, nunca 403:
      confirmar a existência do recurso já seria vazamento. Escopo de `admin` coberto no
      teste de contrato (403 com identidade e sem escopo, 401 sem identidade).
- ✅ **T5.7** `./queue/bullmq` (peer `bullmq` + `ioredis`) e `./queue/amqp` (peer
      `amqplib`) implementando `QueuePort`, com retenção (`removeOnComplete`/`OnFail`) e
      DLQ obrigatórias (`security.md` §6).
- ✅ **T5.8** `createNotificationWorker({ module, concurrency })` + `module.schedules`
      (`dispatch-due`, `purge-expired`, `retry-stuck`) como descritores
      `{ name, cronExpression, run }`.
- ✅ **T5.9** `./openapi` — `notificationOpenApiPaths({ basePath })` derivado da tabela
      de rotas + zod. Teste garante que rota nova sem path OpenAPI **quebra o build**.
- ✅ **T5.10** `./testing` — `createInMemoryPushDriver`/`Email`/`WhatsApp` (com `outcome`
      fixo por construção, que é como o teste do host força retry ou token morto),
      `createControllableQueue` (`drain()` manual: o teste decide QUANDO o job roda, sem
      timer), `createInMemoryCache`, `createStaticRecipientResolver`, `createFixedClock`.
      Em vez de um `createNotificationTestHarness` monolítico, peças compostas — o host
      combina só as que precisa. A suíte do módulo roda sem rede, banco nem broker.

**Aceite verificado:** `hostIntegration.test.ts` **executa** a montagem mínima e prova que
ela responde — o orçamento de ≤ 25 linhas de cola não é conferido por um exemplo de README
que envelhece calado. 75 testes no pacote, `tsc --noEmit` limpo, 7 entrypoints emitindo
esm+cjs+dts.

---

## Fase 6 — Frontend ✅
> 🤖 Modelo: `sonnet`

- ✅ **T6.1** `packages/frontend/notification-client` — cliente HTTP tipado pelo
      contracts, isomórfico (sem DOM), `createDeviceRegistration({ getToken })` com token
      injetado (não importa `expo-notifications` nem `firebase`).
- ✅ **T6.2** Hooks headless em entrypoint próprio (`/headless`): `useNotifications`
      (infinite query), `useUnreadCount`, `useNotificationStream` (SSE, **opt-in** —
      abrir conexão é decisão do host), `useMarkAsRead` (otimista com rollback),
      `useMarkAllAsRead`, `useDeleteNotification`, `usePreferences`,
      `useUpdatePreferences`, `useTemplates`. TanStack Query **do host**, nunca
      instanciado no pacote. `useDeviceRegistration` **não** virou hook: o registro é
      chamada única pós-login, e `createDeviceRegistration` do `-client` já resolve nos
      dois mundos — um hook só para isso seria embrulho sem ganho, e não serviria o RN.
- ✅ **T6.3** `packages/frontend/notification-ui` — `NotificationProvider`,
      `NotificationBell`, `NotificationList`, `NotificationItem`, `PreferencesPanel`.
      **`TemplateAdmin` não entrou**: é CRUD de admin sem consumidor pedindo (o quickcart
      não tem tela de template), e o hook `useTemplates` já está exportado para quem
      precisar montar. Zero cor de marca: tudo por `var(--adn-*, fallback)`, com teste
      garantindo que nenhum hexadecimal de produto entrou no CSS.
- ✅ **T6.4** `pt-BR.json` e `en.json` com override por chave via `messageOverrides`;
      nenhum texto visível em tag ou prop (verificado por teste).
- ✅ **T6.5** Slot `components={{ Item }}` no `NotificationList` + `styles.css` publicado
      como entrypoint próprio.
- ✅ **T6.6** Acessibilidade e responsividade **verificadas por teste que inspeciona o
      fonte**, não por olho: botão só-ícone com `aria-label`, ícone decorativo com
      `aria-hidden`, linha clicável como `<button>` (não `div` com `onClick`), badge com
      `aria-live="polite"`, `role=status`/`role=alert` no feedback, mobile-first sem
      `max-width`, alvo de toque de 44px e dark mode por `prefers-color-scheme`.
      **Não verificado em navegador real** nos três breakpoints — a validação visual
      acontece na Fase 7, quando as telas montarem no PWA do quickcart.

---

## Fase 7 — quickcart de ponta a ponta
> 🤖 Modelo: `sonnet`

- [ ] **T7.1** `Router.mount()` em `apps/api-quickcart/src/infra/http/router.ts` (~20
      linhas): delega ao `match`/`handle` do pacote antes do `registerNotFoundHandler`.
- [ ] **T7.2** `authContextResolver` e `recipientResolver` do quickcart (sessão Bearer
      atual + tabela de clientes), em `modules/notification/infra/`.
- [ ] **T7.3** Compor o módulo no `infra/container.ts` com o `whatsapp.channel` já
      existente (`modules/webhook/infra/whatsapp/metaWhatsAppModule.ts`), driver FCM e
      fila BullMQ sobre o Redis atual. Montar as rotas no `server.ts`.
      **Aceite: ≤ 25 linhas de cola** (métrica da §2 da spec).
- [ ] **T7.4** Trocar `ProcessNotificationJob.use-case` e a guarda por `jobId` por
      `sendNotification` com `dedupeKey` `order:<id>:<status>`; apagar
      `modules/notification` do worker. Sem regressão no fluxo de status de pedido.
- [ ] **T7.5** Registrar os `schedules` no agendador do worker; somar
      `createNotificationWorker` ao `infra/queue/workers.ts`.
- [ ] **T7.6** Merge dos `notificationOpenApiPaths` no Swagger do quickcart.
- [ ] **T7.7** Frontend: sino + lista + preferências no `frontend-web`; web push via FCM
      no service worker do PWA (`vite-plugin-pwa`) — é o que valida o canal push sem
      depender do app mobile.
- [ ] **T7.8** Mailpit no `docker-compose.yml` + targets `notification-migrate`,
      `notification-worker`, `mail-ui` no `Makefile`, com prefixo
      `$(PROJECT_NAME)-$(ENV)-`.
- [ ] **T7.9** Validação E2E em `env.test.e2e`: pedido muda de status → inbox gravado +
      WhatsApp enviado + badge chegando por SSE + retry de push com token inválido
      desativando o device.

---

## Fase 8 — Publicação
> 🤖 Modelo: `haiku` para T8.1–T8.2, **`opus` obrigatório** para T8.3

- [ ] **T8.1** README de cada pacote: instalação, `create…`, tabela de portas, exemplo de
      host (fetch **e** uws), gotchas de `idleTimeout`/Tailwind/Vite.
- [ ] **T8.2** Changesets com destaque para migrations incluídas e portas novas; bump nos
      consumidores.
- [ ] **T8.3** **Gate de revisão com `opus`**: checklist da §13 da spec, caça a bugs de
      lógica/concorrência, auditoria de segurança (PII em log, HMAC, autorização por
      objeto, segredo em mensagem de erro) e de performance (N+1 no fan-out, I/O em série
      no worker, `await` dentro de loop). Nenhuma versão vai ao registry sem este passe.

---

## Fase 9 — Depois do quickcart (fora da v1)
> 🤖 Modelo: `sonnet`

- [ ] **T9.1** `financiamento-imobiliario-bot`: `NodemailerEmailProvider` →
      `email-provider`; webhook de bounce ligado ao hook `onDeliveryBounced`.
- [ ] **T9.2** `sakura-bot-oficial`: notificação de fiscal/entrega.
- [ ] **T9.3** Template `micro-backend-uws`: trocar o `modules/notification` próprio pelo
      adaptador `./http/uws`, para todo projeto novo nascer com notificação.
- [ ] **T9.4** `cawme`: push mobile, quando o backend dele entrar em escopo.
