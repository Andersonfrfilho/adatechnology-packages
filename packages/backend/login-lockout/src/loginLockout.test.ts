/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { toLockoutKey } from './identifierHash'
import { createInMemoryLockoutStore } from './inMemoryLockoutStore'
import { createLoginLockout, LoginLockedError } from './LoginLockout'
import {
  applyFailure,
  DEFAULT_LOCKOUT_POLICY,
  emptyState,
  LockoutPolicyError,
  lockMinutesForLevel,
  resolveLockoutPolicy,
} from './loginLockout.policy'
import type { LockoutSubject } from './loginLockout.types'

const SECRET = 'test-secret-with-enough-length'
const MINUTE = 60_000
const START = new Date('2026-11-01T12:00:00.000Z')

function setUp(policy: Parameters<typeof createLoginLockout>[0]['policy'] = { maxFailedAttempts: 3 }) {
  let current = START
  const store = createInMemoryLockoutStore()
  const lockout = createLoginLockout({ store, secret: SECRET, policy, now: () => current })
  return {
    lockout,
    store,
    advance: (milliseconds: number) => void (current = new Date(current.getTime() + milliseconds)),
  }
}

const SUBJECT: LockoutSubject = { scope: 'guest', identifier: '+5516999990000' }

async function failTimes(lockout: ReturnType<typeof createLoginLockout>, times: number, subject = SUBJECT) {
  let outcome
  for (let attempt = 0; attempt < times; attempt += 1) outcome = await lockout.registerFailure(subject)
  return outcome
}

describe('policy', () => {
  it('duration escalates by the multiplier and stops at the cap', () => {
    const policy = resolveLockoutPolicy({ baseLockMinutes: 15, multiplier: 2, maxLockMinutes: 100 })
    expect([0, 1, 2, 3, 4].map((level) => lockMinutesForLevel({ policy, level }))).toEqual([15, 30, 60, 100, 100])
  })

  it('multiplier 1 keeps a fixed duration', () => {
    const policy = resolveLockoutPolicy({ multiplier: 1 })
    expect(lockMinutesForLevel({ policy, level: 5 })).toBe(policy.baseLockMinutes)
  })

  it('rejects an invalid policy', () => {
    expect(() => resolveLockoutPolicy({ multiplier: 0.5 })).toThrow(LockoutPolicyError)
    expect(() => resolveLockoutPolicy({ maxFailedAttempts: 0 })).toThrow(LockoutPolicyError)
    expect(() => resolveLockoutPolicy({ baseLockMinutes: 60, maxLockMinutes: 30 })).toThrow(LockoutPolicyError)
  })

  it('a failure never extends a lock that is still running', () => {
    const policy = resolveLockoutPolicy({ maxFailedAttempts: 1 })
    const locked = applyFailure({ state: emptyState(START), now: START, policy })
    const again = applyFailure({ state: locked, now: new Date(START.getTime() + MINUTE), policy })
    expect(again.lockedUntil).toEqual(locked.lockedUntil)
    expect(again.hasJustLocked).toBe(false)
  })
})

describe('createLoginLockout', () => {
  it('locks at the threshold and reports it exactly once', async () => {
    const { lockout } = setUp()
    expect((await failTimes(lockout, 2))?.hasJustLocked).toBe(false)
    expect((await lockout.registerFailure(SUBJECT)).hasJustLocked).toBe(true)
    expect((await lockout.registerFailure(SUBJECT)).hasJustLocked).toBe(false)
  })

  it('pre-check throws a generic error with retryAfterSeconds while locked', async () => {
    const { lockout } = setUp()
    await failTimes(lockout, 3)
    const error = await lockout.assertNotLocked(SUBJECT).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(LoginLockedError)
    expect((error as LoginLockedError).retryAfterSeconds).toBe(15 * 60)
    expect((error as Error).message).not.toContain('5516999990000')
  })

  it('locks identifiers that do not exist anywhere, same as real ones', async () => {
    const { lockout } = setUp()
    const ghost = { scope: 'guest', identifier: 'ghost@example.com' }
    await failTimes(lockout, 3, ghost)
    expect((await lockout.check(ghost)).isLocked).toBe(true)
  })

  it('escalates 15 -> 30 -> 60 minutes on repeated locks', async () => {
    const { lockout, advance } = setUp()
    const expected = [15, 30, 60]
    for (const minutes of expected) {
      await failTimes(lockout, 3)
      const status = await lockout.check(SUBJECT)
      expect(status.isLocked && status.retryAfterSeconds).toBe(minutes * 60)
      advance(minutes * MINUTE + 1)
    }
  })

  it('a quiet day forgives counters and escalation level', async () => {
    const { lockout, advance } = setUp()
    await failTimes(lockout, 3)
    advance(DEFAULT_LOCKOUT_POLICY.forgiveAfterMinutes * MINUTE + 1)
    await failTimes(lockout, 3)
    const status = await lockout.check(SUBJECT)
    expect(status.isLocked && status.retryAfterSeconds).toBe(15 * 60)
  })

  it('clear forgives after a successful login', async () => {
    const { lockout } = setUp()
    await failTimes(lockout, 2)
    await lockout.clear(SUBJECT)
    expect((await failTimes(lockout, 2))?.hasJustLocked).toBe(false)
  })

  it('keys by the combination (IP + identifier) and keeps partitions apart', async () => {
    const { lockout } = setUp()
    const pair = { scope: 'guest', identifier: ['203.0.113.7', 'ana@example.com'] }
    await failTimes(lockout, 3, pair)
    expect((await lockout.check(pair)).isLocked).toBe(true)
    expect((await lockout.check({ scope: 'guest', identifier: ['203.0.113.8', 'ana@example.com'] })).isLocked).toBe(
      false,
    )
    expect((await lockout.check({ ...pair, partition: 'tenant-b' })).isLocked).toBe(false)
  })

  it('identifier is normalized (case and spaces)', async () => {
    const { lockout } = setUp()
    await failTimes(lockout, 3, { scope: 'staff', identifier: 'Ana@Example.com ' })
    expect((await lockout.check({ scope: 'staff', identifier: 'ana@example.com' })).isLocked).toBe(true)
  })

  it('concurrent failures all count and cross the limit once', async () => {
    const { lockout } = setUp()
    const outcomes = await Promise.all(Array.from({ length: 10 }, () => lockout.registerFailure(SUBJECT)))
    expect(outcomes.filter((outcome) => outcome.hasJustLocked)).toHaveLength(1)
  })

  it('refuses a short secret', () => {
    expect(() => createLoginLockout({ store: createInMemoryLockoutStore(), secret: 'short' })).toThrow()
  })
})

describe('toLockoutKey', () => {
  it('never contains the identifier and depends on the secret', () => {
    const subject = { scope: 'guest', identifier: '+5516999990000' }
    const key = toLockoutKey({ subject, secret: SECRET })
    expect(key.identifierHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(key)).not.toContain('999990000')
    expect(toLockoutKey({ subject, secret: `${SECRET}-other` }).identifierHash).not.toBe(key.identifierHash)
  })
})
