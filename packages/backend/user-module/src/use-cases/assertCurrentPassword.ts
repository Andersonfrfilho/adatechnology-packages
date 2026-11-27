/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reconferência da senha antes de uma troca sensível. Erra devagar como o login: gasta um hash mesmo sem
 * senha local, conta a falha no bloqueio da conta (`config.lockout`) e recusa conta já bloqueada.
 */

import { CurrentPasswordInvalidError, PasswordNotLocalError, USER_EVENT } from '@adatechnology/user-contracts'

import type { UserRow } from '../schema/schema'
import { nowOf, runHook, type UserDependencies } from './userModule.types'
import { LOCAL_PROVIDER_ID } from '../shared/constants'
import { verifyAgainstDummyHash } from '../shared/dummyPasswordHash'
import { resolveUserLockoutPolicy } from '../shared/lockoutPolicy'

export async function assertCurrentPassword(params: {
  readonly dependencies: UserDependencies
  readonly row: UserRow
  readonly password: string
}): Promise<void> {
  const { dependencies, row } = params
  if (row.providerId !== LOCAL_PROVIDER_ID) throw new PasswordNotLocalError()
  const now = nowOf(dependencies)
  const isValid = row.passwordHash
    ? await Bun.password.verify(params.password, row.passwordHash)
    : await verifyAgainstDummyHash(params.password)
  const isLocked = row.lockedUntil !== null && row.lockedUntil > now
  if (isValid && !isLocked) return

  const lockout = dependencies.config.lockout
  if (lockout && !isLocked) {
    const failure = await dependencies.users.registerFailedLogin({
      id: row.id,
      now,
      maxFailedAttempts: lockout.maxFailedAttempts,
      policy: resolveUserLockoutPolicy(lockout),
    })
    if (failure?.didLock && failure.lockedUntil) {
      const lockedUntil = failure.lockedUntil
      await runHook({
        dependencies,
        name: USER_EVENT.USER_LOCKED,
        run: () =>
          dependencies.hooks?.onUserLocked?.({
            type: USER_EVENT.USER_LOCKED,
            ...(row.companyId ? { companyId: row.companyId } : {}),
            occurredAt: now,
            userId: row.id,
            email: row.email,
            failedAttempts: failure.failedLoginAttempts,
            lockedUntil,
          }),
      })
    }
  }
  throw new CurrentPasswordInvalidError()
}
