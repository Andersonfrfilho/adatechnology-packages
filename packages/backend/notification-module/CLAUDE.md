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
