/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { toLockoutKey } from './identifierHash'
import { isLocked, resolveLockoutPolicy } from './loginLockout.policy'
import type { LockoutOutcome, LockoutPolicy, LockoutStore, LockoutSubject, LockStatus } from './loginLockout.types'

/** Deliberately generic: it must read the same for a real account and for an identifier that does not exist. */
export class LoginLockedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many failed attempts. Try again later.')
    this.name = 'LoginLockedError'
  }
}

export type LoginLockoutOptions = {
  readonly store: LockoutStore
  /** HMAC key for the stored identifiers. Rotating it forgets every current lock. */
  readonly secret: string
  readonly policy?: Partial<LockoutPolicy>
  readonly now?: () => Date
}

export type LoginLockout = {
  /** Cheap pre-check, no side effect. Call it BEFORE verifying the credential. */
  check(subject: LockoutSubject): Promise<LockStatus>
  /** `check` that throws `LoginLockedError` (generic message + `retryAfterSeconds`). */
  assertNotLocked(subject: LockoutSubject): Promise<void>
  /** Counts a failed attempt for known and unknown identifiers alike. */
  registerFailure(subject: LockoutSubject): Promise<LockoutOutcome>
  /** Forgives the subject after a successful login. */
  clear(subject: LockoutSubject): Promise<void>
}

export function createLoginLockout(options: LoginLockoutOptions): LoginLockout {
  const { store, secret } = options
  if (secret.length < 16) throw new Error('login-lockout: secret must have at least 16 characters')
  const policy = resolveLockoutPolicy(options.policy)
  const clock = options.now ?? (() => new Date())
  const keyOf = (subject: LockoutSubject) => toLockoutKey({ subject, secret })

  async function check(subject: LockoutSubject): Promise<LockStatus> {
    const state = await store.find(keyOf(subject))
    const now = clock()
    if (!state?.lockedUntil || !isLocked({ state, now })) return { isLocked: false }
    return {
      isLocked: true,
      lockedUntil: state.lockedUntil,
      retryAfterSeconds: Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000),
    }
  }

  return {
    check,
    async assertNotLocked(subject) {
      const status = await check(subject)
      if (status.isLocked) throw new LoginLockedError(status.retryAfterSeconds)
    },
    registerFailure: (subject) => store.registerFailure({ key: keyOf(subject), now: clock(), policy }),
    clear: (subject) => store.clear(keyOf(subject)),
  }
}
