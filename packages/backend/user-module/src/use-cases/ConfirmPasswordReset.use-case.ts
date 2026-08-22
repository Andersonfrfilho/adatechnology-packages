/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  ResetTokenAlreadyUsedError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  USER_EVENT,
} from '@adatechnology/user-contracts'

import { hashToken } from '../shared/tokenHash'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class ConfirmPasswordResetUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly rawToken: string; readonly newPassword: string }): Promise<void> {
    const tokenHash = hashToken(params.rawToken)
    const now = nowOf(this.dependencies)

    const consumed = await this.dependencies.passwordResetTokens.confirmAndConsume({ tokenHash, now })
    if (!consumed) {
      const existing = await this.dependencies.passwordResetTokens.findByHash({ tokenHash })
      if (!existing) throw new ResetTokenInvalidError()
      if (existing.consumedAt) throw new ResetTokenAlreadyUsedError()
      throw new ResetTokenExpiredError()
    }

    const passwordHash = await Bun.password.hash(params.newPassword)
    const user = await this.dependencies.users.updateById({
      id: consumed.userId,
      values: { passwordHash },
    })
    if (!user) throw new ResetTokenInvalidError()

    // Sem isto a redefinicao nao encerra nada: quem roubou a sessao continua com refresh token
    // valido justamente depois do gesto feito para expulsa-lo.
    await this.dependencies.refreshTokenStore.revokeAllForUser({ userId: user.id })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.PASSWORD_CHANGED,
      run: () =>
        this.dependencies.hooks?.onPasswordChanged?.({
          type: USER_EVENT.PASSWORD_CHANGED,
          companyId: user.companyId ?? undefined,
          occurredAt: now,
          userId: user.id,
        }),
    })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.PASSWORD_RESET_COMPLETED,
      run: () =>
        this.dependencies.hooks?.onPasswordResetCompleted?.({
          type: USER_EVENT.PASSWORD_RESET_COMPLETED,
          companyId: user.companyId ?? undefined,
          occurredAt: now,
          userId: user.id,
          email: user.email,
        }),
    })
  }
}
