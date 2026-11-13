/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Journal table fora do `pgSchema('user')`: a própria primeira migration cria o schema, e o
 * migrator precisaria do schema pronto para criar a journal table dentro dele — mesma corrida
 * evitada pelo `catalog_migrations` do catalog-module.
 */

import { join } from 'node:path'

import type { UserDatabase } from './database.types'

export const USER_MIGRATIONS_TABLE = 'user_migrations'

export function userMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunUserMigrationsParams = {
  readonly db: UserDatabase
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runUserMigrations(params: RunUserMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: userMigrationsFolder(),
    migrationsTable: USER_MIGRATIONS_TABLE,
  })
}
