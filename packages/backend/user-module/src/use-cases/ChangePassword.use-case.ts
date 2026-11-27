/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Troca de senha pela própria pessoa. Encerra as outras sessões; a atual segue (um refresh novo).
 */

import { USER_EVENT, UserNotFoundError } from '@adatechnology/user-contracts'

import { resolveRefreshExpiresInSeconds } from '../shared/refreshLifetime'
import { resolveScopeCompanyId } from '../shared/tenancy'
import { assertCurrentPassword } from './assertCurrentPassword'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export type ChangePasswordParams = {
  readonly id: string
  readonly currentPassword: string
  readonly newPassword: string
  readonly companyId?: string
  /** Presente = a sessão de quem trocou continua, com um refresh token novo (`rememberMe` herdado do cookie). */
  readonly keepSession?: { readonly rememberMe?: boolean }
}

export type ChangePasswordResult = {
  readonly refreshToken: string
  readonly refreshExpiresInSeconds: number
  readonly rememberMe?: boolean
}

export class ChangePasswordUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: ChangePasswordParams): Promise<ChangePasswordResult | undefined> {
    const { dependencies } = this
    const companyId = resolveScopeCompanyId({ tenancy: dependencies.config.tenancy, explicit: params.companyId })
    const existing = await dependencies.users.findById({ companyId, id: params.id })
    if (!existing) throw new UserNotFoundError()
    await assertCurrentPassword({ dependencies, row: existing, password: params.currentPassword })

    const passwordHash = await Bun.password.hash(params.newPassword)
    const row = await dependencies.users.update({
      companyId,
      id: params.id,
      values: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, lockLevel: 0, lastFailedLoginAt: null },
    })
    if (!row) throw new UserNotFoundError()

    await dependencies.refreshTokenStore.revokeAllForUser({ userId: row.id })
    const session = params.keepSession
      ? await this.reopenSession({ userId: row.id, keepSession: params.keepSession })
      : undefined

    await runHook({
      dependencies,
      name: USER_EVENT.PASSWORD_CHANGED,
      run: () =>
        dependencies.hooks?.onPasswordChanged?.({
          type: USER_EVENT.PASSWORD_CHANGED,
          ...(companyId ? { companyId } : {}),
          occurredAt: nowOf(dependencies),
          userId: row.id,
        }),
    })
    return session
  }

  private async reopenSession(params: {
    readonly userId: string
    readonly keepSession: { readonly rememberMe?: boolean }
  }): Promise<ChangePasswordResult> {
    const { rememberMe } = params.keepSession
    const refreshExpiresInSeconds = resolveRefreshExpiresInSeconds({ config: this.dependencies.config, rememberMe })
    const refreshToken = await this.dependencies.refreshTokenStore.issue({
      userId: params.userId,
      expiresInSeconds: refreshExpiresInSeconds,
      ...(rememberMe === undefined ? {} : { rememberMe }),
    })
    return { refreshToken, refreshExpiresInSeconds, ...(rememberMe === undefined ? {} : { rememberMe }) }
  }
}
