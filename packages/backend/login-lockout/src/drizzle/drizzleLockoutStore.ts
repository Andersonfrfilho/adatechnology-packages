/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq } from 'drizzle-orm'
import type { PgAsyncDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { applyFailure } from '../loginLockout.policy'
import type {
  LockoutKey,
  LockoutOutcome,
  LockoutState,
  LockoutStore,
  RegisterFailureParams,
} from '../loginLockout.types'
import type { LoginLockoutsTable } from './loginLockoutsTable'

type AnyPgDatabase = PgAsyncDatabase<PgQueryResultHKT, any>

type Row = {
  readonly id: string
  readonly failures: number
  readonly lockLevel: number
  readonly lockedUntil: Date | null
  readonly lastFailureAt: Date
}

function toState(row: Row): LockoutState {
  return {
    failures: row.failures,
    lockLevel: row.lockLevel,
    lockedUntil: row.lockedUntil ?? undefined,
    lastFailureAt: row.lastFailureAt,
  }
}

/**
 * Postgres store. `registerFailure` runs insert-if-absent + `SELECT ... FOR UPDATE` + update in one transaction, so
 * parallel failures serialize on the row: every one is counted and exactly one crosses the limit. Persisted per subject
 * (known or not), so a restart or a deploy never hands an attacker a clean slate.
 */
export function createDrizzleLockoutStore(params: {
  readonly database: AnyPgDatabase
  readonly table: LoginLockoutsTable
}): LockoutStore {
  const { database, table } = params
  const matching = (key: LockoutKey) =>
    and(eq(table.partition, key.partition), eq(table.scope, key.scope), eq(table.identifierHash, key.identifierHash))

  return {
    async find(key) {
      const [row] = (await database.select().from(table).where(matching(key))) as Row[]
      return row ? toState(row) : undefined
    },
    async registerFailure({ key, now, policy }: RegisterFailureParams): Promise<LockoutOutcome> {
      return database.transaction(async (transaction) => {
        await transaction
          .insert(table)
          .values({
            partition: key.partition,
            scope: key.scope,
            identifierHash: key.identifierHash,
            lastFailureAt: now,
          })
          .onConflictDoNothing()
        const [row] = (await transaction.select().from(table).where(matching(key)).for('update')) as Row[]
        if (!row) throw new Error('login-lockout: row missing after insert')
        const outcome = applyFailure({ state: toState(row), now, policy })
        await transaction
          .update(table)
          .set({
            failures: outcome.failures,
            lockLevel: outcome.lockLevel,
            lockedUntil: outcome.lockedUntil ?? null,
            lastFailureAt: outcome.lastFailureAt,
          })
          .where(eq(table.id, row.id))
        return outcome
      })
    },
    async clear(key) {
      await database.delete(table).where(matching(key))
    },
  }
}
