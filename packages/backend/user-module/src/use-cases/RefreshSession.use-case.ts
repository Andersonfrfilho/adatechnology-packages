/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { NotAuthenticatedError, type UserSession } from '@adatechnology/user-contracts'

import { DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '../shared/constants'
import { toUserProfile } from '../shared/toContract'
import { hashToken } from '../shared/tokenHash'
import type { UserDependencies } from './userModule.types'

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly refreshToken: string }): Promise<UserSession> {
    const refreshExpiresInSeconds =
      this.dependencies.config.refreshToken?.expiresInSeconds ?? DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS

    const rotated = await this.dependencies.refreshTokenStore.rotate({
      tokenHash: hashToken(params.refreshToken),
      newExpiresInSeconds: refreshExpiresInSeconds,
    })
    if (!rotated) throw new NotAuthenticatedError()

    const row = await this.dependencies.users.findByIdUnscoped({ id: rotated.userId })
    if (!row || !row.isActive) throw new NotAuthenticatedError()

    const profile = toUserProfile(row)
    const { accessToken, expiresInSeconds } = await this.dependencies.tokenService.sign(profile)

    return { accessToken, expiresInSeconds, refreshToken: rotated.token, refreshExpiresInSeconds, user: profile }
  }
}
