/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { applyFailure, emptyState } from './loginLockout.policy'
import type {
  LockoutKey,
  LockoutOutcome,
  LockoutState,
  LockoutStore,
  RegisterFailureParams,
} from './loginLockout.types'

const keyOf = (key: LockoutKey) => `${key.partition}|${key.scope}|${key.identifierHash}`

/** For tests and single-process tools. Lost on restart — production uses `createDrizzleLockoutStore`. */
export function createInMemoryLockoutStore(): LockoutStore {
  const states = new Map<string, LockoutState>()
  return {
    async find(key) {
      return states.get(keyOf(key))
    },
    async registerFailure(params: RegisterFailureParams): Promise<LockoutOutcome> {
      const current = states.get(keyOf(params.key)) ?? emptyState(params.now)
      const outcome = applyFailure({ state: current, now: params.now, policy: params.policy })
      states.set(keyOf(params.key), {
        failures: outcome.failures,
        lockLevel: outcome.lockLevel,
        lockedUntil: outcome.lockedUntil,
        lastFailureAt: outcome.lastFailureAt,
      })
      return outcome
    },
    async clear(key) {
      states.delete(keyOf(key))
    },
  }
}
