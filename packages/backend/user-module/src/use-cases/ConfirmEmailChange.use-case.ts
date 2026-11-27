/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Passo 2: o link aberto no endereço novo prova a posse e troca o e-mail da conta. O host avisa o
 * endereço antigo pelo hook `onEmailChanged` (`previousEmail`).
 */

import {
  ConfirmationTokenInvalidError,
  EmailAlreadyExistsError,
  USER_EVENT,
  type UserProfile,
} from '@adatechnology/user-contracts'

import { ACCOUNT_CHALLENGE_KIND } from '../repositories/AccountChallengeRepository'
import { isUniqueViolation } from '../shared/databaseErrors'
import { hashToken } from '../shared/tokenHash'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class ConfirmEmailChangeUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly rawToken: string }): Promise<UserProfile> {
    const { dependencies } = this
    const now = nowOf(dependencies)
    const consumed = await dependencies.accountChallenges.consumeBySecret({
      kind: ACCOUNT_CHALLENGE_KIND.EMAIL_CHANGE,
      secretHash: hashToken(params.rawToken),
      now,
    })
    if (!consumed) throw new ConfirmationTokenInvalidError()

    const before = await dependencies.users.findByIdUnscoped({ id: consumed.userId })
    if (!before) throw new ConfirmationTokenInvalidError()
    const companyId = before.companyId ?? undefined
    if (await dependencies.users.findByEmail({ companyId, email: consumed.target })) throw new EmailAlreadyExistsError()

    const row = await dependencies.users
      .updateById({ id: before.id, values: { email: consumed.target, emailVerifiedAt: now } })
      .catch((error: unknown) => {
        throw isUniqueViolation(error) ? new EmailAlreadyExistsError() : error
      })
    if (!row) throw new ConfirmationTokenInvalidError()

    await runHook({
      dependencies,
      name: USER_EVENT.EMAIL_CHANGED,
      run: () =>
        dependencies.hooks?.onEmailChanged?.({
          type: USER_EVENT.EMAIL_CHANGED,
          ...(companyId ? { companyId } : {}),
          occurredAt: now,
          userId: row.id,
          previousEmail: before.email,
          newEmail: row.email,
        }),
    })
    return toUserProfile(row)
  }
}
