/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { UserNotFoundError, USER_EVENT, type UserProfile } from '@adatechnology/user-contracts'

import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import { nowOf, runHook, type UserDependencies } from './userModule.types'

export class UpdateProfileUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly id: string
    readonly name: string
    readonly companyId?: string
  }): Promise<UserProfile> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })

    const row = await this.dependencies.users.update({ companyId, id: params.id, values: { name: params.name } })
    if (!row) throw new UserNotFoundError()

    const profile = toUserProfile(row)

    await runHook({
      dependencies: this.dependencies,
      name: USER_EVENT.PROFILE_UPDATED,
      run: () =>
        this.dependencies.hooks?.onProfileUpdated?.({
          type: USER_EVENT.PROFILE_UPDATED,
          companyId,
          occurredAt: nowOf(this.dependencies),
          userId: row.id,
          user: profile,
        }),
    })

    return profile
  }
}
