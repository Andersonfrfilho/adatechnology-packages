/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { StockDatabase, DrizzleMigrateFunction } from './database.types'

// Journal próprio, fora do pgSchema `stock`: a primeira migration é quem cria esse schema
// (mesmo raciocínio de `catalog-module/runMigrations.ts`).
export const STOCK_MIGRATIONS_TABLE = 'stock_migrations'

/** Pasta no formato clássico (`meta/_journal.json`), lida pelos migrators do drizzle 0.x e 1.x. */
export function stockMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunStockMigrationsParams = {
  readonly db: StockDatabase
  /** O `migrate` do driver do host (`drizzle-orm/node-postgres/migrator`, `.../bun-sql/migrator`…). */
  readonly migrate: DrizzleMigrateFunction
}

export async function runStockMigrations(params: RunStockMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: stockMigrationsFolder(),
    migrationsTable: STOCK_MIGRATIONS_TABLE,
  })
}
