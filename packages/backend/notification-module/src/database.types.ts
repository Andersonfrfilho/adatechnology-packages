/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Conexão Drizzle aceita pelo módulo. Deliberadamente o tipo genérico do pg-core, e não um driver
// concreto — o módulo só usa o query builder (select/insert/update), nada específico de driver.
// Mesmo desenho de `meta-whatsapp-module/database.types.ts`.
export type NotificationDatabase = PgDatabase<PgQueryResultHKT, any, any>

// Assinatura do `migrate` do drizzle, igual em todos os drivers. Recebida por injeção porque o
// migrator É específico de driver (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) e importar um deles aqui reintroduziria o acoplamento que
// este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
