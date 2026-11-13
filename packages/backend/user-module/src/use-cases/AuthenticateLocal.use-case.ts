/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InvalidCredentialsError, USER_EVENT, type UserSession } from '@adatechnology/user-contracts'

import { DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '../shared/constants'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class AuthenticateLocalUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly email: string
    readonly password: string
    readonly ipAddress?: string
    readonly companyId?: string
  }): Promise<UserSession> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const row = await this.dependencies.users.findByEmail({ companyId, email: params.email })

    const isValid = row?.passwordHash ? await Bun.password.verify(params.password, row.passwordHash) : false

    if (!row || !isValid || !row.isActive) {
      await runHook({
        dependencies: this.dependencies,
        name: USER_EVENT.LOGIN_FAILED,
        run: () =>
          this.dependencies.hooks?.onLoginFailed?.({
            type: USER_EVENT.LOGIN_FAILED,
            companyId,
            occurredAt: nowOf(this.dependencies),
            email: params.email,
            ipAddress: params.ipAddress ?? '',
            reason: !row ? 'user_not_found' : !isValid ? 'invalid_password' : 'user_inactive',
          }),
      })
      throw new InvalidCredentialsError()
    }

    const profile = toUserProfile(row)
    const { accessToken, expiresInSeconds } = await this.dependencies.tokenService.sign(profile)
    const refreshExpiresInSeconds =
      this.dependencies.config.refreshToken?.expiresInSeconds ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS
    const refreshToken = await this.dependencies.refreshTokenStore.issue({
      userId: row.id,
      expiresInSeconds: refreshExpiresInSeconds,
    })

    await this.dependencies.users.update({ companyId, id: row.id, values: { lastSeenAt: nowOf(this.dependencies) } })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.LOGIN_SUCCEEDED,
      run: () =>
        this.dependencies.hooks?.onLoginSucceeded?.({
          type: USER_EVENT.LOGIN_SUCCEEDED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: row.id,
          email: row.email,
          ipAddress: params.ipAddress ?? '',
        }),
    })

    return { accessToken, expiresInSeconds, refreshToken, refreshExpiresInSeconds, user: profile }
  }
}
