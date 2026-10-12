/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { InfraDatabase } from './database.types'

// Journal próprio, fora do pgSchema `infra`: a primeira migration é quem CRIA o schema.
export const INFRA_MIGRATIONS_TABLE = 'infra_migrations'

export function infraMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunInfraMigrationsParams = {
  readonly db: InfraDatabase
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runInfraMigrations(params: RunInfraMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: infraMigrationsFolder(),
    migrationsTable: INFRA_MIGRATIONS_TABLE,
  })
}
