/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Conexão Drizzle aceita pelo módulo. Deliberadamente o tipo genérico do pg-core, e não um driver
// concreto — o módulo só usa o query builder (select/insert/update), nada específico de driver.
// Mesmo desenho de `meta-whatsapp-module/database.types.ts`.
// `PgAsyncDatabase` é o nome do tipo no drizzle 1.x (era `PgDatabase` no 0.x).
/**
 * `PgDatabase`, e nao `PgAsyncDatabase`: este ultimo so existe no drizzle-orm 1.x, e o
 * `peerDependencies` aceita `>=0.36 <2` — todo host do ecossistema esta na 0.45. Tipar contra a
 * API da 1.x fazia o pacote nao compilar contra a versao que os hosts realmente instalam, e e o
 * mesmo desalinhamento que gerava as migrations num formato que o migrator da 0.45 nao le.
 */
export type NotificationDatabase = PgDatabase<PgQueryResultHKT, any, any>

// Transação derivada do próprio `db`, para não depender do nome da classe de transação — que mudou
// junto com `PgDatabase` na virada do drizzle 1.x.
export type NotificationTransaction = Parameters<Parameters<NotificationDatabase['transaction']>[0]>[0]

// Assinatura do `migrate` do drizzle, igual em todos os drivers. Recebida por injeção porque o
// migrator É específico de driver (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) e importar um deles aqui reintroduziria o acoplamento que
// este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
