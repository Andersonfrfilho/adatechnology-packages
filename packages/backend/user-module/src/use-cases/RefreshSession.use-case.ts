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

  /**
   * `rememberMe` é só a dica do cookie de um token emitido antes de o servidor registrar a escolha: a
   * loja padrão a ignora quando o token já a guarda. Token novo não depende dela.
   */
  async execute(params: { readonly refreshToken: string; readonly rememberMe?: boolean }): Promise<UserSession> {
    const { config } = this.dependencies
    const reuseGraceSeconds = config.refreshToken?.reuseGraceSeconds
    const absoluteExpiresInSeconds = config.refreshToken?.absoluteExpiresInSeconds
    // Para loja customizada que só conhece `newExpiresInSeconds`: o comportamento de antes, pela dica.
    const hintedExpiresInSeconds = resolveRefreshExpiresInSeconds({ config, rememberMe: params.rememberMe })

    const rotated = await this.dependencies.refreshTokenStore.rotate({
      tokenHash: hashToken(params.refreshToken),
      newExpiresInSeconds: hintedExpiresInSeconds,
      expiresInSecondsByChoice: {
        remember: resolveRefreshExpiresInSeconds({ config, rememberMe: true }),
        session: resolveRefreshExpiresInSeconds({ config, rememberMe: false }),
      },
      ...(params.rememberMe === undefined ? {} : { rememberMeHint: params.rememberMe }),
      ...(absoluteExpiresInSeconds === undefined ? {} : { absoluteExpiresInSeconds }),
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

    const rememberMe = rotated.rememberMe ?? params.rememberMe
    return {
      accessToken,
      expiresInSeconds,
      refreshToken: rotated.token,
      refreshExpiresInSeconds: rotated.expiresInSeconds ?? hintedExpiresInSeconds,
      ...(rememberMe === undefined ? {} : { rememberMe }),
      user: profile,
    }
  }
}
