/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Atualização administrativa: papel e situação. O módulo nunca apaga usuário — desativa.
 */

import { UserNotFoundError, USER_EVENT, type UserProfile, type UserUpdateChanges } from '@adatechnology/user-contracts'

import type { NewUserRow } from '../schema/schema'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

const CLEARED_LOCKOUT = { failedLoginAttempts: 0, lockedUntil: null } as const

export type UpdateUserParams = {
  readonly id: string
  readonly role?: string
  readonly isActive?: boolean
  /** Limpa o bloqueio por tentativas falhas. Reativar a conta também limpa. */
  readonly unlock?: boolean
  readonly companyId?: string
}

export class UpdateUserUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: UpdateUserParams): Promise<UserProfile> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })

    const existing = await this.dependencies.users.findById({ companyId, id: params.id })
    if (!existing) throw new UserNotFoundError()

    const isRoleChange = params.role !== undefined && params.role !== existing.role
    const isActiveChange = params.isActive !== undefined && params.isActive !== existing.isActive
    const isUnlock = params.unlock === true || (isActiveChange && params.isActive === true)

    if (!isRoleChange && !isActiveChange && !isUnlock) return toUserProfile(existing)

    const values: Partial<NewUserRow> = {
      ...(isRoleChange && params.role !== undefined ? { role: params.role } : {}),
      ...(isActiveChange && params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(isUnlock ? CLEARED_LOCKOUT : {}),
    }

    const row = await this.dependencies.users.update({ companyId, id: params.id, values })
    if (!row) throw new UserNotFoundError()

    // Papel novo e desativação só valem no access token quando ele expira (curto); o refresh é o que
    // permitiria renovar o papel antigo ou manter a sessão de quem foi desligado.
    const hasSessionsRevoked = isRoleChange || (isActiveChange && params.isActive === false)
    if (hasSessionsRevoked) await this.dependencies.refreshTokenStore.revokeAllForUser({ userId: row.id })

    const profile = toUserProfile(row)
    const changes: UserUpdateChanges = {
      ...(isRoleChange && params.role !== undefined ? { role: { from: existing.role, to: params.role } } : {}),
      ...(isActiveChange && params.isActive !== undefined
        ? { isActive: { from: existing.isActive, to: params.isActive } }
        : {}),
      ...(isUnlock ? { unlocked: true } : {}),
      sessionsRevoked: hasSessionsRevoked,
    }

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.USER_UPDATED,
      run: () =>
        this.dependencies.hooks?.onUserUpdated?.({
          type: USER_EVENT.USER_UPDATED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: row.id,
          user: profile,
          changes,
        }),
    })

    return profile
  }
}
