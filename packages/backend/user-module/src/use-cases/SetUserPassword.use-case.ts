/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O administrador define a senha de outra pessoa (primeiro acesso, conta esquecida sem e-mail).
 */

import { PasswordNotLocalError, UserNotFoundError, USER_EVENT } from '@adatechnology/user-contracts'

import { LOCAL_PROVIDER_ID } from '../shared/constants'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export type SetUserPasswordParams = {
  readonly id: string
  readonly password: string
  readonly companyId?: string
  /** Quem definiu, para a trilha de auditoria do host (`onPasswordChanged`). */
  readonly actorUserId?: string
}

export class SetUserPasswordUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: SetUserPasswordParams): Promise<void> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })

    const existing = await this.dependencies.users.findById({ companyId, id: params.id })
    if (!existing) throw new UserNotFoundError()
    // Senha local em conta de provedor externo abriria uma segunda porta que o provedor não controla.
    if (existing.providerId !== LOCAL_PROVIDER_ID) throw new PasswordNotLocalError()

    const passwordHash = await Bun.password.hash(params.password)
    const row = await this.dependencies.users.update({
      companyId,
      id: params.id,
      values: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    })
    if (!row) throw new UserNotFoundError()

    // Senha nova encerra as sessões abertas: é o gesto usado quando a conta pode estar comprometida.
    await this.dependencies.refreshTokenStore.revokeAllForUser({ userId: row.id })

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.PASSWORD_CHANGED,
      run: () =>
        this.dependencies.hooks?.onPasswordChanged?.({
          type: USER_EVENT.PASSWORD_CHANGED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: row.id,
          ...(params.actorUserId ? { changedByUserId: params.actorUserId } : {}),
        }),
    })
  }
}
