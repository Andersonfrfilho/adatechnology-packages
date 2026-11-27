/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Recuperação assistida (quem perdeu o e-mail e o telefone): a equipe, depois de conferir a identidade
 * fora do sistema, troca o e-mail da conta e/ou a destrava. Trocar o e-mail encerra as sessões e envia
 * ao endereço novo o link para criar a senha. A trilha leva quem agiu e o quê — nunca os valores.
 */

import {
  ConfigMissingError,
  EmailAlreadyExistsError,
  USER_EVENT,
  UserNotFoundError,
  type UserProfile,
} from '@adatechnology/user-contracts'

import type { NewUserRow } from '../schema/schema'
import { isUniqueViolation } from '../shared/databaseErrors'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { RequestPasswordResetUseCase } from './RequestPasswordReset.use-case'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

const CLEARED_LOCKOUT = { failedLoginAttempts: 0, lockedUntil: null, lockLevel: 0, lastFailedLoginAt: null } as const

export type RecoverAccountParams = {
  readonly id: string
  readonly email?: string
  readonly unlock?: boolean
  readonly actorUserId?: string
  readonly companyId?: string
  readonly ipAddress?: string
}

export class RecoverAccountUseCase {
  private readonly requestReset: RequestPasswordResetUseCase

  constructor(private readonly dependencies: UserDependencies) {
    this.requestReset = new RequestPasswordResetUseCase(dependencies)
  }

  async execute(params: RecoverAccountParams): Promise<UserProfile> {
    const { dependencies } = this
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const existing = await dependencies.users.findById({ companyId, id: params.id })
    if (!existing) throw new UserNotFoundError()

    const isEmailUpdated = params.email !== undefined && params.email !== existing.email
    const isUnlocked = params.unlock === true || isEmailUpdated
    if (isEmailUpdated && !dependencies.config.passwordReset) throw new ConfigMissingError('passwordReset')
    if (isEmailUpdated && params.email && (await dependencies.users.findByEmail({ companyId, email: params.email }))) {
      throw new EmailAlreadyExistsError()
    }

    const values: Partial<NewUserRow> = {
      ...(isEmailUpdated && params.email ? { email: params.email, emailVerifiedAt: null } : {}),
      ...(isUnlocked ? CLEARED_LOCKOUT : {}),
    }
    const row =
      Object.keys(values).length === 0
        ? existing
        : await dependencies.users.update({ companyId, id: existing.id, values }).catch((error: unknown) => {
            throw isUniqueViolation(error) ? new EmailAlreadyExistsError() : error
          })
    if (!row) throw new UserNotFoundError()

    // O e-mail antigo pode estar em mãos erradas: as sessões abertas acabam junto com ele.
    if (isEmailUpdated) await dependencies.refreshTokenStore.revokeAllForUser({ userId: row.id })
    if (isEmailUpdated) {
      await this.requestReset.execute({
        email: row.email,
        ...(companyId ? { companyId } : {}),
        ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      })
    }

    await runHook({
      dependencies,
      name: USER_EVENT.ACCOUNT_RECOVERED,
      run: () =>
        dependencies.hooks?.onAccountRecovered?.({
          type: USER_EVENT.ACCOUNT_RECOVERED,
          ...(companyId ? { companyId } : {}),
          occurredAt: nowOf(dependencies),
          userId: row.id,
          ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
          isEmailUpdated,
          isUnlocked,
          isResetSent: isEmailUpdated,
        }),
    })
    return toUserProfile(row)
  }
}
