/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { ContentDatabase, DrizzleMigrateFunction } from './database.types'

// Journal próprio, fora do pgSchema `content`: a primeira migration é quem cria esse schema
// (mesmo raciocínio de `catalog-module/runMigrations.ts`).
export const CONTENT_MIGRATIONS_TABLE = 'content_migrations'

/** Pasta no formato clássico (`meta/_journal.json`), lida pelos migrators do drizzle 0.x e 1.x. */
export function contentMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunContentMigrationsParams = {
  readonly db: ContentDatabase
  /** O `migrate` do driver do host (`drizzle-orm/node-postgres/migrator`, `.../bun-sql/migrator`…). */
  readonly migrate: DrizzleMigrateFunction
}

export async function runContentMigrations(params: RunContentMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: contentMigrationsFolder(),
    migrationsTable: CONTENT_MIGRATIONS_TABLE,
  })
}
