/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Contra um Postgres de verdade, pulado sem `LOGIN_LOCKOUT_TEST_DATABASE_URL`
 * (ex: `postgres://postgres:test@localhost:5432/test`). É o único lugar onde "atômico" é provado.
 */

import { SQL } from 'bun'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sql'

import { createLoginLockout } from '../LoginLockout'
import { createDrizzleLockoutStore } from './drizzleLockoutStore'
import { loginLockouts } from './loginLockoutsTable'

const DATABASE_URL = process.env['LOGIN_LOCKOUT_TEST_DATABASE_URL']
const describeWithDatabase = DATABASE_URL ? describe : describe.skip

describeWithDatabase('createDrizzleLockoutStore', () => {
  const sql = new SQL(DATABASE_URL ?? 'postgres://unused')
  const database = drizzle({ client: sql })

  beforeAll(async () => {
    await sql.unsafe('drop table if exists "login_lockouts"')
    await sql.unsafe(`create table "login_lockouts" (
      "id" uuid primary key default gen_random_uuid(),
      "partition" varchar(64) not null default '',
      "scope" varchar(40) not null,
      "identifier_hash" varchar(64) not null,
      "failures" integer not null default 0,
      "lock_level" integer not null default 0,
      "locked_until" timestamptz,
      "last_failure_at" timestamptz not null default now()
    )`)
    await sql.unsafe(
      'create unique index "login_lockouts_subject_unique" on "login_lockouts" ("partition","scope","identifier_hash")',
    )
  })

  afterAll(async () => {
    await sql.unsafe('drop table if exists "login_lockouts"')
  })

  it('serializes parallel failures: all are counted and one crosses the limit', async () => {
    const store = createDrizzleLockoutStore({ database, table: loginLockouts })
    const lockout = createLoginLockout({
      store,
      secret: 'test-secret-with-enough-length',
      policy: { maxFailedAttempts: 3 },
    })
    const subject = { scope: 'guest', identifier: 'ghost@example.com' }

    const outcomes = await Promise.all(Array.from({ length: 10 }, () => lockout.registerFailure(subject)))

    expect(outcomes.filter((outcome) => outcome.hasJustLocked)).toHaveLength(1)
    expect((await lockout.check(subject)).isLocked).toBe(true)
    await lockout.clear(subject)
    expect((await lockout.check(subject)).isLocked).toBe(false)
  })
})
