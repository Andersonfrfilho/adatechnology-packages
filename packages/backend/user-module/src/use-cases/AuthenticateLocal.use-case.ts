/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InvalidCredentialsError, USER_EVENT, type UserSession } from '@adatechnology/user-contracts'

import type { UserRow } from '../schema/schema'
import { verifyAgainstDummyHash } from '../shared/dummyPasswordHash'
import { resolveRefreshExpiresInSeconds } from '../shared/refreshLifetime'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

const FAILURE_REASON = {
  USER_NOT_FOUND: 'user_not_found',
  INVALID_PASSWORD: 'invalid_password',
  USER_INACTIVE: 'user_inactive',
  USER_LOCKED: 'user_locked',
} as const

type FailureReason = (typeof FAILURE_REASON)[keyof typeof FAILURE_REASON]

type LoginAttempt = {
  readonly companyId: string | undefined
  readonly email: string
  readonly ipAddress: string
}

export class AuthenticateLocalUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly email: string
    readonly password: string
    readonly ipAddress?: string
    readonly companyId?: string
    readonly rememberMe?: boolean
  }): Promise<UserSession> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const attempt: LoginAttempt = { companyId, email: params.email, ipAddress: params.ipAddress ?? '' }
    const row = await this.dependencies.users.findByEmail({ companyId, email: params.email })

    // Sempre gasta uma verificação de hash — conta ausente, sem senha local ou bloqueada incluídas.
    const isPasswordValid = row?.passwordHash
      ? await Bun.password.verify(params.password, row.passwordHash)
      : await verifyAgainstDummyHash(params.password)

    if (!row) return this.rejectLogin({ attempt, row, reason: FAILURE_REASON.USER_NOT_FOUND })
    const reason = this.failureReasonOf({ row, isPasswordValid })
    if (reason) return this.rejectLogin({ attempt, row, reason })
    const user = row

    // O `UPDATE` recusa conta bloqueada entre a leitura da senha e agora: fecha a corrida com o bloqueio.
    const signedInRow = await this.dependencies.users.registerSuccessfulLogin({
      id: user.id,
      now: nowOf(this.dependencies),
    })
    if (!signedInRow) return this.rejectLogin({ attempt, row: user, reason: FAILURE_REASON.USER_LOCKED })

    const profile = toUserProfile(signedInRow)
    const { accessToken, expiresInSeconds } = await this.dependencies.tokenService.sign(profile)
    const refreshExpiresInSeconds = resolveRefreshExpiresInSeconds({
      config: this.dependencies.config,
      rememberMe: params.rememberMe,
    })
    const refreshToken = await this.dependencies.refreshTokenStore.issue({
      userId: user.id,
      expiresInSeconds: refreshExpiresInSeconds,
      ...(params.rememberMe === undefined ? {} : { rememberMe: params.rememberMe }),
    })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.LOGIN_SUCCEEDED,
      run: () =>
        this.dependencies.hooks?.onLoginSucceeded?.({
          type: USER_EVENT.LOGIN_SUCCEEDED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: user.id,
          email: user.email,
          ipAddress: attempt.ipAddress,
        }),
    })

    return {
      accessToken,
      expiresInSeconds,
      refreshToken,
      refreshExpiresInSeconds,
      ...(params.rememberMe === undefined ? {} : { rememberMe: params.rememberMe }),
      user: profile,
    }
  }

  private failureReasonOf(params: { row: UserRow; isPasswordValid: boolean }): FailureReason | undefined {
    const { row, isPasswordValid } = params
    if (row.lockedUntil && row.lockedUntil > nowOf(this.dependencies)) return FAILURE_REASON.USER_LOCKED
    if (!isPasswordValid) return FAILURE_REASON.INVALID_PASSWORD
    if (!row.isActive) return FAILURE_REASON.USER_INACTIVE
    return undefined
  }

  /** Conta a falha (quando há bloqueio configurado), avisa o host e lança sempre o mesmo erro. */
  private async rejectLogin(params: {
    attempt: LoginAttempt
    row: UserRow | undefined
    reason: FailureReason
  }): Promise<never> {
    const { attempt, row, reason } = params
    const lockout = this.dependencies.config.lockout
    const now = nowOf(this.dependencies)

    const failure =
      lockout && row && reason === FAILURE_REASON.INVALID_PASSWORD
        ? await this.dependencies.users.registerFailedLogin({
            id: row.id,
            now,
            maxFailedAttempts: lockout.maxFailedAttempts,
            lockMinutes: lockout.lockMinutes,
          })
        : undefined

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.LOGIN_FAILED,
      run: () =>
        this.dependencies.hooks?.onLoginFailed?.({
          type: USER_EVENT.LOGIN_FAILED,
          companyId: attempt.companyId,
          occurredAt: now,
          email: attempt.email,
          ipAddress: attempt.ipAddress,
          reason,
          ...(row ? { userId: row.id } : {}),
        }),
    })

    if (row && failure?.didLock && failure.lockedUntil) {
      const lockedUntil = failure.lockedUntil
      await runHook({
        dependencies: this.dependencies,
        name: USER_EVENT.USER_LOCKED,
        run: () =>
          this.dependencies.hooks?.onUserLocked?.({
            type: USER_EVENT.USER_LOCKED,
            companyId: attempt.companyId,
            occurredAt: now,
            userId: row.id,
            email: row.email,
            failedAttempts: failure.failedLoginAttempts,
            lockedUntil,
          }),
      })
    }

    throw new InvalidCredentialsError()
  }
}
