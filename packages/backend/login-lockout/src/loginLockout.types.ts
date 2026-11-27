/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type LockoutPolicy = {
  /** Failures that trigger a lock. */
  readonly maxFailedAttempts: number
  /** Duration of the first lock. */
  readonly baseLockMinutes: number
  /** Each new lock lasts `multiplier` times the previous one (1 keeps a fixed duration). */
  readonly multiplier: number
  /** Ceiling for any single lock. */
  readonly maxLockMinutes: number
  /** A quiet period this long wipes the failure counter and the escalation level. */
  readonly forgiveAfterMinutes: number
}

export type LockoutState = {
  readonly failures: number
  readonly lockLevel: number
  readonly lockedUntil: Date | undefined
  readonly lastFailureAt: Date
}

export type LockoutOutcome = LockoutState & { readonly hasJustLocked: boolean }

/** Storage coordinates of one subject. `identifierHash` is an HMAC, never the identifier itself. */
export type LockoutKey = {
  readonly partition: string
  readonly scope: string
  readonly identifierHash: string
}

/** Subject as the caller sees it. An array keys the lock by the combination (e.g. `[ip, email]`). */
export type LockoutSubject = {
  /** Tenant / company; locks never cross partitions. */
  readonly partition?: string
  /** Population being guarded (`guest`, `staff`, ...). */
  readonly scope: string
  readonly identifier: string | readonly string[]
}

export type RegisterFailureParams = {
  readonly key: LockoutKey
  readonly now: Date
  readonly policy: LockoutPolicy
}

/** Persistence port. `registerFailure` MUST be atomic: concurrent failures all count, one crosses the limit. */
export type LockoutStore = {
  find(key: LockoutKey): Promise<LockoutState | undefined>
  registerFailure(params: RegisterFailureParams): Promise<LockoutOutcome>
  clear(key: LockoutKey): Promise<void>
}

export type LockStatus =
  | { readonly isLocked: false }
  | { readonly isLocked: true; readonly lockedUntil: Date; readonly retryAfterSeconds: number }
