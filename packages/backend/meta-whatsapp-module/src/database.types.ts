import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Conexão Drizzle aceita pelo módulo. Deliberadamente o tipo genérico do pg-core, e não um
// driver concreto: o módulo só usa o query builder (select/insert/update), nada específico de
// driver, então amarrá-lo a `BunSQLDatabase` excluía sem motivo todo host em node-postgres ou
// postgres.js — foi o que travou o QuickCart, que roda em node-postgres.
//
// Os genéricos ficam abertos de propósito. Fechá-los no schema do host obrigaria o módulo a
// conhecer as tabelas dele, e o schema `meta_whatsapp` é acessado pelos objetos de tabela que o
// próprio módulo carrega — não pelo `db.query` tipado do host.

type QueryBuilderMethod = (...args: never[]) => unknown

/**
 * Forma mínima de uma conexão Drizzle Postgres: os métodos do query builder que o módulo chama.
 * É o que um host em drizzle-orm 0.36–0.45 (`PgDatabase`, sem `PgAsyncDatabase`) é checado contra —
 * um `Pool` do `pg` ou outro objeto qualquer não passa.
 */
export type MetaWhatsAppDatabaseShape = {
  readonly select: QueryBuilderMethod
  readonly insert: QueryBuilderMethod
  readonly update: QueryBuilderMethod
  readonly delete: QueryBuilderMethod
  readonly execute: QueryBuilderMethod
  readonly transaction: QueryBuilderMethod
}

type IsAny<TValue> = 0 extends 1 & TValue ? true : false

/**
 * `PgAsyncDatabase` só existe no drizzle-orm 1.x. Num host em 0.x o import acima não resolve e, com
 * `skipLibCheck`, vira `any` — qualquer coisa passava como `db`. Nesse caso vale a forma mínima; em
 * 1.x continua o tipo exato, sem mudança para quem já usa.
 */
export type MetaWhatsAppDatabaseFor<TAsyncDatabase> =
  IsAny<TAsyncDatabase> extends true ? MetaWhatsAppDatabaseShape : TAsyncDatabase

export type MetaWhatsAppDatabase = MetaWhatsAppDatabaseFor<PgAsyncDatabase<PgQueryResultHKT>>

// Assinatura do `migrate` do drizzle, igual em todos os drivers. Recebida por injeção porque o
// migrator É específico de driver (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) e importar um deles aqui reintroduziria o acoplamento
// que este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
