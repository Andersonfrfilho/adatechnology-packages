/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { join } from 'node:path'

import type { DrizzleMigrateFunction, ExpenseDatabase } from './database.types'

/**
 * Journal próprio (`drizzle.expense_migrations`): nunca colide com as migrations do host. Fica no schema `drizzle`
 * porque é a primeira migration do módulo que cria o schema `expense`.
 */
export const EXPENSE_MIGRATIONS_TABLE = 'expense_migrations'

/** Pasta das migrations embarcadas, para o host que prefere chamar o próprio migrator. */
export function expenseMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export async function runExpenseMigrations(params: {
  readonly db: ExpenseDatabase
  readonly migrate: DrizzleMigrateFunction
}): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: expenseMigrationsFolder(),
    migrationsTable: EXPENSE_MIGRATIONS_TABLE,
  })
}
