/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Journal próprio, separado do `catalog_migrations`. A extensão `vector` não vem no Postgres
 * padrão, e uma migration que falha derruba a subida do host inteiro: quem só gerencia catálogo
 * não pode deixar de subir por causa de uma capacidade que não usa.
 */

import { join } from 'node:path'

import type { CatalogDatabase, DrizzleMigrateFunction } from './database.types'

export const CATALOG_VISION_MIGRATIONS_TABLE = 'catalog_vision_migrations'

export function catalogVisionMigrationsFolder(): string {
  return join(__dirname, 'migrations-vision')
}

export type RunCatalogVisionMigrationsParams = {
  readonly db: CatalogDatabase
  readonly migrate: DrizzleMigrateFunction
}

export async function runCatalogVisionMigrations(params: RunCatalogVisionMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: catalogVisionMigrationsFolder(),
    migrationsTable: CATALOG_VISION_MIGRATIONS_TABLE,
  })
}
