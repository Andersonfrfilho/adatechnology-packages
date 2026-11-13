/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Tipo genérico do pg-core, não um driver concreto: o módulo só usa o query builder, e amarrá-lo
// a `BunSQLDatabase` excluiria sem motivo todo host em node-postgres ou postgres.js. Mesmo
// desenho de `catalog-module` e `notification-module`.
export type SchedulingDatabase = PgDatabase<PgQueryResultHKT, any, any>

// O `migrate` É específico de driver (`drizzle-orm/node-postgres/migrator`,
// `drizzle-orm/bun-sql/migrator`, ...) — importar um deles aqui reintroduziria o acoplamento que
// este arquivo existe para remover.
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
