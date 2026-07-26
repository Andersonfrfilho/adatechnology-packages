import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Conexão Drizzle aceita pelo módulo. Deliberadamente o tipo genérico do pg-core, e não um
// driver concreto: o módulo só usa o query builder (select/insert/update), nada específico de
// driver, então amarrá-lo a `BunSQLDatabase` excluía sem motivo todo host em node-postgres ou
// postgres.js — foi o que travou o QuickCart, que roda em node-postgres.
//
// Os genéricos ficam abertos de propósito. Fechá-los no schema do host obrigaria o módulo a
// conhecer as tabelas dele, e o schema `meta_whatsapp` é acessado pelos objetos de tabela que o
// próprio módulo carrega — não pelo `db.query` tipado do host.

export type MetaWhatsAppDatabase = PgDatabase<PgQueryResultHKT, any, any>

// Assinatura do `migrate` do drizzle, igual em todos os drivers. Recebida por injeção porque o
// migrator É específico de driver (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) e importar um deles aqui reintroduziria o acoplamento
// que este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
