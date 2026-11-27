/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  type AnyPgColumn,
  integer,
  type PgTable,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const LOGIN_LOCKOUTS_TABLE_NAME = 'login_lockouts'
export const LOGIN_LOCKOUTS_UNIQUE_INDEX_NAME = 'login_lockouts_subject_unique'

/** Columns every lockout table has. Reusable inside a `pgSchema(...).table(...)`. */
export function loginLockoutColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    partition: varchar('partition', { length: 64 }).notNull().default(''),
    scope: varchar('scope', { length: 40 }).notNull(),
    identifierHash: varchar('identifier_hash', { length: 64 }).notNull(),
    failures: integer('failures').notNull().default(0),
    lockLevel: integer('lock_level').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }).notNull().defaultNow(),
  }
}

export function loginLockoutIndexes(table: {
  partition: AnyPgColumn
  scope: AnyPgColumn
  identifierHash: AnyPgColumn
}) {
  return [uniqueIndex(LOGIN_LOCKOUTS_UNIQUE_INDEX_NAME).on(table.partition, table.scope, table.identifierHash)]
}

/** One row per subject being guessed, known or not. The identifier is an HMAC, never the phone or e-mail. */
export const loginLockouts = pgTable(LOGIN_LOCKOUTS_TABLE_NAME, loginLockoutColumns(), loginLockoutIndexes)

/** Any table built from `loginLockoutColumns()`, in whatever schema the host keeps it. */
export type LoginLockoutsTable = PgTable & {
  readonly id: AnyPgColumn
  readonly partition: AnyPgColumn
  readonly scope: AnyPgColumn
  readonly identifierHash: AnyPgColumn
  readonly failures: AnyPgColumn
  readonly lockLevel: AnyPgColumn
  readonly lockedUntil: AnyPgColumn
  readonly lastFailureAt: AnyPgColumn
}
