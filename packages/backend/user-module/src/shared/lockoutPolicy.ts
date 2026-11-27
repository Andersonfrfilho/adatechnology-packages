/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { type LockoutPolicy, resolveLockoutPolicy } from '@adatechnology/login-lockout'
import type { LockoutConfig } from '@adatechnology/user-contracts'

const DEFAULT_MAX_LOCK_MINUTES = 24 * 60
const DEFAULT_FORGIVE_AFTER_MINUTES = 24 * 60

/** Sem `lockMultiplier` a duração é fixa (`lockMinutes`), como era antes da escalada existir. */
export function resolveUserLockoutPolicy(config: LockoutConfig): LockoutPolicy {
  return resolveLockoutPolicy({
    maxFailedAttempts: config.maxFailedAttempts,
    baseLockMinutes: config.lockMinutes,
    multiplier: config.lockMultiplier ?? 1,
    maxLockMinutes: config.maxLockMinutes ?? Math.max(config.lockMinutes, DEFAULT_MAX_LOCK_MINUTES),
    forgiveAfterMinutes: config.forgiveAfterMinutes ?? DEFAULT_FORGIVE_AFTER_MINUTES,
  })
}
