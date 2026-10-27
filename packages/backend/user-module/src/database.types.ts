/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type UserDatabase = PgAsyncDatabase<PgQueryResultHKT, any>

export type DrizzleMigrateFunction = (
  db: never,
  config: { migrationsFolder: string; migrationsTable?: string },
) => Promise<void>
