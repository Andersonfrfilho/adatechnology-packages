/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Conexão Drizzle aceita pelo módulo. Deliberadamente o tipo genérico do pg-core, e não um conector
// concreto — o módulo só usa o query builder (select/insert/update), nada específico de conector.
// Mesmo desenho de `notification-module/database.types.ts`. No drizzle-orm 1.x o assíncrono é
// `PgAsyncDatabase`, que só carrega dois genéricos (`TQueryResult`, `TRelations`) — `PgDatabase`
// e o terceiro genérico de schema saíram do pg-core.
export type ConversationDatabase = PgAsyncDatabase<PgQueryResultHKT>

// Transação derivada do próprio `db`, para não depender do nome da classe de transação.
export type ConversationTransaction = Parameters<Parameters<ConversationDatabase['transaction']>[0]>[0]

// Assinatura do `migrate` do drizzle, igual em todos os conectores. Recebida por injeção porque o
// migrator É específico de conector (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) e importar um deles aqui reintroduziria o acoplamento que
// este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
