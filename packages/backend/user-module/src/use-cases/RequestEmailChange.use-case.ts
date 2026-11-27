/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Passo 1 da troca de e-mail: prova a senha e manda um link de uso único ao endereço NOVO. A conta
 * segue com o e-mail antigo até o link ser aberto.
 */

import {
  ConfigMissingError,
  EmailAlreadyExistsError,
  USER_EVENT,
  UserNotFoundError,
} from '@adatechnology/user-contracts'

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import { buildDefaultEmailChangeEmail } from '../shared/emailChangeEmail'
import { generateRawToken, hashToken } from '../shared/tokenHash'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { assertCurrentPassword } from './assertCurrentPassword'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

const TOKEN_PLACEHOLDER = '{token}'
export const DEFAULT_EMAIL_CHANGE_EXPIRES_IN_SECONDS = 24 * 60 * 60

export class RequestEmailChangeUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly id: string
    readonly currentPassword: string
    readonly newEmail: string
    readonly companyId?: string
  }): Promise<void> {
    const { dependencies } = this
    const config = dependencies.config.emailChange
    if (!config) throw new ConfigMissingError('emailChange')
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const row = await dependencies.users.findById({ companyId, id: params.id })
    if (!row) throw new UserNotFoundError()
    await assertCurrentPassword({ dependencies, row, password: params.currentPassword })
    if (await dependencies.users.findByEmail({ companyId, email: params.newEmail })) throw new EmailAlreadyExistsError()

    const now = nowOf(dependencies)
    const expiresInSeconds = config.tokenExpiresInSeconds ?? DEFAULT_EMAIL_CHANGE_EXPIRES_IN_SECONDS
    const rawToken = generateRawToken()
    await dependencies.accountChallenges.issue({
      userId: row.id,
      kind: ACCOUNT_CHALLENGE_KIND.EMAIL_CHANGE,
      secretHash: hashToken(rawToken),
      target: params.newEmail,
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
      now,
    })
    const confirmUrl = config.confirmUrlTemplate.replace(TOKEN_PLACEHOLDER, rawToken)

    if (dependencies.email) {
      const content = (config.buildEmail ?? buildDefaultEmailChangeEmail)({
        confirmUrl,
        name: row.name,
        expiresInSeconds,
      })
      const result = await dependencies.email.send({ to: params.newEmail, ...content })
      if (result.outcome !== 'sent') {
        dependencies.logger?.warn('user.email_change_email_failed', {
          userId: row.id,
          outcome: result.outcome,
          errorCode: result.errorCode,
        })
      }
    }

    await runHook({
      dependencies,
      name: USER_EVENT.EMAIL_CHANGE_REQUESTED,
      run: () =>
        dependencies.hooks?.onEmailChangeRequested?.({
          type: USER_EVENT.EMAIL_CHANGE_REQUESTED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: row.id,
          newEmail: params.newEmail,
          confirmUrl,
          expiresInSeconds,
        }),
    })
  }
}
