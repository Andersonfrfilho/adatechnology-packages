/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { NotAuthenticatedError, USER_EVENT, type UserSession } from '@adatechnology/user-contracts'

import { resolveRefreshExpiresInSeconds } from '../shared/refreshLifetime'
import { toUserProfile } from '../shared/toContract'
import { hashToken } from '../shared/tokenHash'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class RefreshSessionUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly refreshToken: string; readonly rememberMe?: boolean }): Promise<UserSession> {
    const reuseGraceSeconds = this.dependencies.config.refreshToken?.reuseGraceSeconds
    const refreshExpiresInSeconds = resolveRefreshExpiresInSeconds({
      config: this.dependencies.config,
      rememberMe: params.rememberMe,
    })

    const rotated = await this.dependencies.refreshTokenStore.rotate({
      tokenHash: hashToken(params.refreshToken),
      newExpiresInSeconds: refreshExpiresInSeconds,
      ...(reuseGraceSeconds === undefined ? {} : { reuseGraceSeconds }),
    })
    if (!rotated) throw new NotAuthenticatedError()

    if ('reusedForUserId' in rotated) {
      // A loja padrão já revogou; repetir aqui cobre uma loja customizada que só sinaliza o reuso.
      await this.dependencies.refreshTokenStore.revokeAllForUser({ userId: rotated.reusedForUserId })
      await runHook({
        dependencies: this.dependencies,
        name: USER_EVENT.REFRESH_REUSE_DETECTED,
        run: () =>
          this.dependencies.hooks?.onRefreshReuseDetected?.({
            type: USER_EVENT.REFRESH_REUSE_DETECTED,
            occurredAt: nowOf(this.dependencies),
            userId: rotated.reusedForUserId,
          }),
      })
      throw new NotAuthenticatedError()
    }

    const row = await this.dependencies.users.findByIdUnscoped({ id: rotated.userId })
    if (!row || !row.isActive) {
      // Não deixa viva a sessão recém-emitida de quem não pode mais entrar.
      await this.dependencies.refreshTokenStore.revoke({ tokenHash: hashToken(rotated.token) })
      throw new NotAuthenticatedError()
    }

    const profile = toUserProfile(row)
    const { accessToken, expiresInSeconds } = await this.dependencies.tokenService.sign(profile)

    return { accessToken, expiresInSeconds, refreshToken: rotated.token, refreshExpiresInSeconds, user: profile }
  }
}
