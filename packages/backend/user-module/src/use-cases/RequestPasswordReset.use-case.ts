/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ConfigMissingError, USER_EVENT } from '@adatechnology/user-contracts'

import { DEFAULT_RESET_TOKEN_EXPIRES_IN_SECONDS } from '../shared/constants'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { generateRawToken, hashToken } from '../shared/tokenHash'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

const RESET_TOKEN_PLACEHOLDER = '{token}'

export class RequestPasswordResetUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  /**
   * Resposta uniforme independente de o e-mail existir — mesma defesa do login contra
   * enumeração de conta. Só cria token (e dispara hook/e-mail) quando o usuário existe de
   * verdade; para quem não existe, o método simplesmente retorna.
   */
  async execute(params: {
    readonly email: string
    readonly ipAddress?: string
    readonly companyId?: string
  }): Promise<void> {
    const { passwordReset } = this.dependencies.config
    if (!passwordReset) throw new ConfigMissingError('passwordReset')

    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const row = await this.dependencies.users.findByEmail({ companyId, email: params.email })
    if (!row) return

    const rawToken = generateRawToken()
    const expiresInSeconds = passwordReset.tokenExpiresInSeconds ?? DEFAULT_RESET_TOKEN_EXPIRES_IN_SECONDS
    const now = nowOf(this.dependencies)

    await this.dependencies.passwordResetTokens.create({
      userId: row.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
      requestedIp: params.ipAddress,
    })

    const resetUrl = passwordReset.resetUrlTemplate.replace(RESET_TOKEN_PLACEHOLDER, rawToken)

    if (this.dependencies.email) {
      const result = await this.dependencies.email.send({
        to: row.email,
        subject: 'Redefinição de senha',
        body: `Use o link a seguir para redefinir sua senha: ${resetUrl}`,
      })
      if (!result.success) {
        this.dependencies.logger?.warn('user.password_reset_email_failed', { userId: row.id, error: result.error })
      }
    }

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.PASSWORD_RESET_REQUESTED,
      run: () =>
        this.dependencies.hooks?.onPasswordResetRequested?.({
          type: USER_EVENT.PASSWORD_RESET_REQUESTED,
          companyId,
          occurredAt: now,
          email: row.email,
          resetUrl,
        }),
    })
  }
}
