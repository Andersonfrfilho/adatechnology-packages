/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { SchedulingDatabase } from './database.types'

// Journal próprio, fora do pgSchema `scheduling`: a primeira migration é quem CRIA esse schema, e
// apontar o journal para dentro dele geraria corrida entre o migrator garantindo o schema da
// tabela de controle e a migration tentando criá-lo de novo (mesmo raciocínio de
// `meta-whatsapp-module/runMigrations.ts` e `catalog-module/runMigrations.ts`).
export const SCHEDULING_MIGRATIONS_TABLE = 'scheduling_migrations'

export function schedulingMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunSchedulingMigrationsParams = {
  readonly db: SchedulingDatabase
  readonly migrate: (db: never, config: { migrationsFolder: string; migrationsTable?: string }) => Promise<void>
}

export async function runSchedulingMigrations(params: RunSchedulingMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: schedulingMigrationsFolder(),
    migrationsTable: SCHEDULING_MIGRATIONS_TABLE,
  })
}
