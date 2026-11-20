/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O tipo do banco vem do host: o módulo só usa o query builder e não escolhe driver.
 */
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type ExpenseDatabase = PgDatabase<PgQueryResultHKT, any, any>

/** O `migrate` do driver do host (`drizzle-orm/node-postgres/migrator`, `drizzle-orm/bun-sql/migrator`, ...). */
export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
