/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export * from './schema'
export { runCustomerMigrations, customerMigrationsFolder, CUSTOMER_MIGRATIONS_TABLE } from './runMigrations'
export type { RunCustomerMigrationsParams } from './runMigrations'
export type { CustomerDatabase } from './database.types'
