/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { RecipeDatabase, DrizzleMigrateFunction } from './database.types'

// Journal próprio, fora do pgSchema `recipes`: a primeira migration é quem cria esse schema
// (mesmo raciocínio de `catalog-module/runMigrations.ts`).
export const RECIPE_MIGRATIONS_TABLE = 'recipe_migrations'

/** Pasta no formato clássico (`meta/_journal.json`), lida pelos migrators do drizzle 0.x e 1.x. */
export function recipeMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunRecipeMigrationsParams = {
  readonly db: RecipeDatabase
  /** O `migrate` do driver do host (`drizzle-orm/node-postgres/migrator`, `.../bun-sql/migrator`…). */
  readonly migrate: DrizzleMigrateFunction
}

export async function runRecipeMigrations(params: RunRecipeMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: recipeMigrationsFolder(),
    migrationsTable: RECIPE_MIGRATIONS_TABLE,
  })
}
