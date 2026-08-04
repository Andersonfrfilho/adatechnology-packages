# CLAUDE.md — @adatechnology/notification-module

## Propósito

Camada de dados do trio de notificações — `pgSchema('notification')`, migrations com journal
próprio, e repositories que escopam **toda** query por `companyId` (e por `recipientUserId`/
`userId` quando o objeto pertence a uma pessoa, não só ao tenant).

Spec: `.specs/features/notification-trio/spec.md` (Fase 3). ADR:
`docs/adr/0001-notification-trio.md`. Esta é só a camada de **dados** — `createNotificationModule`,
use-cases, HTTP e worker chegam na Fase 4/5.

## Tabelas

`templates` · `notifications` (com `deletedAt` para soft delete) · `deliveries` (companyId
denormalizado — nenhuma leitura precisa de join com `notifications` para filtrar tenant) ·
`devices` · `preferences` · `suppressions`. Detalhe de colunas e índices: spec §5.

## Migrations

```bash
pnpm --filter @adatechnology/notification-module run db:generate   # gera SQL a partir do schema
```

Journal em `drizzle.notification_migrations` (schema `drizzle`, fora de `notification` — a
primeira migration é quem cria o schema `notification`, então o journal não pode viver lá dentro,
mesmo raciocínio de `meta-whatsapp-module/runMigrations.ts`).

```ts
import { runNotificationMigrations } from '@adatechnology/notification-module'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

await runNotificationMigrations({ db, migrate })
```

## Isolamento multiempresa — como é garantido

Toda condição de leitura/escrita alcançável por uma requisição de usuário é uma função **pura e
exportada** (`notificationInboxCondition`, `notificationOwnedByCondition`,
`deviceActiveByUserCondition`, `preferenceByUserCondition`, ...), usada dentro do repositório e
testada por renderização de SQL em `repositories/isolation.test.ts` (`PgDialect().sqlToQuery()`,
sem Postgres real — mesmo padrão de `meta-whatsapp-module/repositories/SessionRepository.test.ts`).

Ganho de manter a condição numa função exportada, e não inline no `.where()`: um refactor futuro
que esqueça o filtro de empresa quebra o teste na hora, porque o teste chama a mesma função que o
método de produção chama — não uma reconstrução da lógica.

**Exceção documentada:** `DeliveryRepository.findByProviderMessage` não é escopado por
`companyId` — o webhook de recibo chega só com o id que o provedor emitiu, e é essa busca que
descobre a empresa. Não é rota aberta ao cliente; só a rota de webhook (HMAC) chama isto.

## Templates são histórico imutável

`TemplateRepository.upsert` nunca sobrescreve uma versão — cada chamada cria a próxima
(`version + 1`). `findActive` lê a versão mais alta com `active = true`. Uma notificação já
enviada permanece auditável com o texto que ela realmente usou.

## Upsert em lote sem loop

`PreferenceRepository.upsertMany` é uma única instrução `INSERT ... ON CONFLICT DO UPDATE` com
`excluded.*` no `set` — não um upsert por preferência em `for`/`await` (`nodejs.md`, "nunca
`await` dentro de loop").

## Paginação por cursor

`repositories/cursor.ts` — `(createdAt, id)` como chave composta, não só `createdAt`: dois envios
no mesmo milissegundo (comum em fan-out de fila) empatariam e perderiam ou duplicariam linhas
entre páginas sem o `id` como desempate.

## Comandos

```bash
pnpm --filter @adatechnology/notification-module run check   # tsc --noEmit
pnpm --filter @adatechnology/notification-module run test    # bun test
pnpm --filter @adatechnology/notification-module run build   # tsup (esm + cjs + dts)
```

## Fronteira HTTP — rota é dado, não código

`createNotificationRoutes({ module, webhookSecret })` devolve uma `NotificationRouteTable`: 13
rotas (14 com webhook habilitado), cada uma com método, path, escopo, schemas zod e um handler
puro. **Nenhum tipo de framework** entra nessa tabela — e é dela que derivam três coisas que não
podem divergir:

| Consumidor | Entrypoint |
|---|---|
| Adaptador WHATWG (`Bun.serve`, Router do quickcart, Hono) | `./http/fetch` |
| Adaptador uWebSockets.js (template `micro-backend-uws`) | `./http/uws` |
| Paths OpenAPI para o Swagger do host | `./openapi` |

`http/dispatchRoute.ts` é o núcleo compartilhado: casa a rota, valida body/query, resolve
identidade, checa escopo, chama o handler e converte exceção em resposta. Os adaptadores só
traduzem transporte — por isso `http/adapterContract.test.ts` roda a mesma bateria nos dois e
exige status e envelope idênticos.

### Montagem no host (≤ 25 linhas — critério de aceite)

```ts
import { createNotificationRoutes } from '@adatechnology/notification-module'
import { createNotificationFetchRouter } from '@adatechnology/notification-module/http/fetch'

const notificationHttp = createNotificationFetchRouter({
  routes: createNotificationRoutes({ module: notification, webhookSecret: environment.NOTIFICATION_WEBHOOK_SECRET }),
  basePath: '/v1',
  authResolver: authContextResolver,
})

// no router do host, antes do 404:
if (notificationHttp.match(request)) return notificationHttp.handle(request)
```

`http/hostIntegration.test.ts` executa exatamente essa montagem — o orçamento de linhas é
verificado por teste que roda, não por um exemplo no README que envelhece calado.

### SSE do inbox

`GET /notifications/stream`, heartbeat de 25 s por default. **O `idleTimeout` do `Bun.serve`
precisa ser MAIOR que o heartbeat** — o quickcart perdeu o stream de conversa por causa disso
(`api-quickcart/src/index.ts:48`). O primeiro evento sai imediatamente na conexão, senão uma aba
recém-aberta ficaria com o badge zerado até a próxima notificação.

Sem `RealtimeNotifierPort.subscribe` injetado, o stream usa o notificador em processo, que **só
entrega na mesma instância**: com duas réplicas, quem está na A não recebe o evento nascido na B.
Host com mais de uma instância implementa a porta sobre o pub/sub dele.

## Fila e cron

`./queue/bullmq` e `./queue/amqp` implementam `QueuePort`; ambos com peer opcional. Os dois
enfileiram com `attempts: 1` de propósito — **o retry é decidido por `applyDeliveryOutcome`**,
que distingue `retriable` de `permanent`; deixar o broker retentar duplicaria a política e
reenviaria também o que é definitivo.

```ts
createNotificationWorker({ module: notification, queue }).start()
for (const schedule of createNotificationSchedules(notification)) {
  cron.register(schedule.name, schedule.cronExpression, schedule.run)
}
```

**Limitação do AMQP:** delay depende do plugin `rabbitmq-delayed-message-exchange`. Sem ele o
broker entrega na hora, e o backoff de retry e o reagendamento por quiet hours perdem a espera.

## `./testing`

Dublês de driver (`createInMemoryPushDriver` e afins, com `outcome` fixo para forçar retry ou
token morto), `createControllableQueue` (o teste decide QUANDO o job roda, sem timer) e
`createInMemoryCache`. O host testa o próprio wiring sem rede, banco nem broker.
