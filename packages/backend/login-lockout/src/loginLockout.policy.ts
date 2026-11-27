/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { LockoutOutcome, LockoutPolicy, LockoutState } from './loginLockout.types'

const MINUTE_MILLISECONDS = 60_000

export const DEFAULT_LOCKOUT_POLICY: LockoutPolicy = {
  maxFailedAttempts: 5,
  baseLockMinutes: 15,
  multiplier: 2,
  maxLockMinutes: 24 * 60,
  forgiveAfterMinutes: 24 * 60,
}

export class LockoutPolicyError extends Error {
  constructor(field: keyof LockoutPolicy) {
    super(`login-lockout: invalid policy field "${field}"`)
    this.name = 'LockoutPolicyError'
  }
}

export function resolveLockoutPolicy(overrides: Partial<LockoutPolicy> = {}): LockoutPolicy {
  const policy = { ...DEFAULT_LOCKOUT_POLICY, ...overrides }
  if (!Number.isInteger(policy.maxFailedAttempts) || policy.maxFailedAttempts < 1)
    throw new LockoutPolicyError('maxFailedAttempts')
  if (!(policy.baseLockMinutes > 0)) throw new LockoutPolicyError('baseLockMinutes')
  if (!(policy.multiplier >= 1)) throw new LockoutPolicyError('multiplier')
  if (!(policy.maxLockMinutes >= policy.baseLockMinutes)) throw new LockoutPolicyError('maxLockMinutes')
  if (!(policy.forgiveAfterMinutes > 0)) throw new LockoutPolicyError('forgiveAfterMinutes')
  return policy
}

export function lockMinutesForLevel(params: { readonly policy: LockoutPolicy; readonly level: number }): number {
  const { policy, level } = params
  return Math.min(policy.baseLockMinutes * policy.multiplier ** level, policy.maxLockMinutes)
}

export function isLocked(params: { readonly state: Pick<LockoutState, 'lockedUntil'>; readonly now: Date }): boolean {
  return params.state.lockedUntil !== undefined && params.state.lockedUntil.getTime() > params.now.getTime()
}

export function isForgiven(params: {
  readonly state: Pick<LockoutState, 'lastFailureAt'>
  readonly now: Date
  readonly policy: LockoutPolicy
}): boolean {
  return (
    params.now.getTime() - params.state.lastFailureAt.getTime() >
    params.policy.forgiveAfterMinutes * MINUTE_MILLISECONDS
  )
}

/** State of a subject that has never failed (or was forgiven). */
export function emptyState(now: Date): LockoutState {
  return { failures: 0, lockLevel: 0, lockedUntil: undefined, lastFailureAt: now }
}

/**
 * Counts one failure. Reaching `maxFailedAttempts` locks for `base * multiplier^level` minutes (capped) and raises the
 * level; the counter restarts. A failure never extends a lock that is still running.
 */
export function applyFailure(params: {
  readonly state: LockoutState
  readonly now: Date
  readonly policy: LockoutPolicy
}): LockoutOutcome {
  const { state, now, policy } = params
  if (isLocked({ state, now })) return { ...state, hasJustLocked: false }

  const forgiven = isForgiven({ state, now, policy })
  const failures = (forgiven ? 0 : state.failures) + 1
  const lockLevel = forgiven ? 0 : state.lockLevel
  if (failures < policy.maxFailedAttempts)
    return { failures, lockLevel, lockedUntil: undefined, lastFailureAt: now, hasJustLocked: false }

  const lockedUntil = new Date(now.getTime() + lockMinutesForLevel({ policy, level: lockLevel }) * MINUTE_MILLISECONDS)
  return { failures: 0, lockLevel: lockLevel + 1, lockedUntil, lastFailureAt: now, hasJustLocked: true }
}
