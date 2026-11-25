/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

// Tipo genérico do pg-core, não um driver concreto: o módulo só usa o query builder, e amarrá-lo
// a um driver excluiria sem motivo o host em node-postgres, postgres.js ou Bun SQL. Mesmo desenho
// de `catalog-module`.

export type ContentDatabase = PgDatabase<PgQueryResultHKT, any, any>

export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
