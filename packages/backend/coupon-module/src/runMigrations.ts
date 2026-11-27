/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { join } from 'node:path'

import type { CouponDatabase, DrizzleMigrateFunction } from './database.types'

// Journal próprio, fora do pgSchema `coupons`: a primeira migration é quem cria esse schema
// (mesmo raciocínio de `catalog-module/runMigrations.ts`).
export const COUPON_MIGRATIONS_TABLE = 'coupon_migrations'

/** Pasta no formato clássico (`meta/_journal.json`), lida pelos migrators do drizzle 0.x e 1.x. */
export function couponMigrationsFolder(): string {
  return join(__dirname, 'migrations')
}

export type RunCouponMigrationsParams = {
  readonly db: CouponDatabase
  /** O `migrate` do driver do host (`drizzle-orm/node-postgres/migrator`, `.../bun-sql/migrator`…). */
  readonly migrate: DrizzleMigrateFunction
}

export async function runCouponMigrations(params: RunCouponMigrationsParams): Promise<void> {
  await params.migrate(params.db as never, {
    migrationsFolder: couponMigrationsFolder(),
    migrationsTable: COUPON_MIGRATIONS_TABLE,
  })
}
