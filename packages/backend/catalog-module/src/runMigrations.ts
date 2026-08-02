/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { CatalogDatabase } from './database.types'

// Journal próprio, fora do pgSchema `catalog`: a primeira migration é quem CRIA esse schema, e
// apontar o journal para dentro dele geraria corrida entre o migrator garantindo o schema da
// tabela de controle e a migration tentando criá-lo de novo (mesmo raciocínio de
// `meta-whatsapp-module/runMigrations.ts`).
export const CATALOG_MIGRATIONS_TABLE = 'catalog_migrations'

export function catalogMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunCatalogMigrationsParams = {
  readonly db: CatalogDatabase
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runCatalogMigrations(params: RunCatalogMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: catalogMigrationsFolder(),
    migrationsTable: CATALOG_MIGRATIONS_TABLE,
  })
}
