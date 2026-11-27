/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export { createLoginLockout, LoginLockedError } from './LoginLockout'
export type { LoginLockout, LoginLockoutOptions } from './LoginLockout'
export { createInMemoryLockoutStore } from './inMemoryLockoutStore'
export { toLockoutKey } from './identifierHash'
export {
  applyFailure,
  DEFAULT_LOCKOUT_POLICY,
  emptyState,
  isForgiven,
  isLocked,
  LockoutPolicyError,
  lockMinutesForLevel,
  resolveLockoutPolicy,
} from './loginLockout.policy'
export type {
  LockoutKey,
  LockoutOutcome,
  LockoutPolicy,
  LockoutState,
  LockoutStore,
  LockoutSubject,
  LockStatus,
  RegisterFailureParams,
} from './loginLockout.types'
