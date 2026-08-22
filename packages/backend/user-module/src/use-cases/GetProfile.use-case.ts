/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { UserNotFoundError, type UserProfile } from '@adatechnology/user-contracts'

import { resolveScopeCompanyId } from '../shared/tenancy'
import { toUserProfile } from '../shared/toContract'
import type { UserDependencies } from './userModule.types'

export class GetProfileUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: { readonly id: string; readonly companyId?: string }): Promise<UserProfile> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const row = await this.dependencies.users.findById({ companyId, id: params.id })
    if (!row) throw new UserNotFoundError()
    return toUserProfile(row)
  }
}
