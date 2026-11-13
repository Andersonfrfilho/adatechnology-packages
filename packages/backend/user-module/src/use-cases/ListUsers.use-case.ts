/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PaginatedResponse, UserProfile } from '@adatechnology/user-contracts'

import { resolveScopeCompanyId } from '../shared/tenancy'
import { signAvatars } from '../shared/signAvatar'
import { toPaginatedUsers } from '../shared/toContract'
import type { UserDependencies } from './userModule.types'

const DEFAULT_PAGE = 1
const DEFAULT_PER_PAGE = 20

export class ListUsersUseCase {
  constructor(private readonly dependencies: UserDependencies) {}

  async execute(params: {
    readonly page?: number
    readonly perPage?: number
    readonly companyId?: string
  }): Promise<PaginatedResponse<UserProfile>> {
    const companyId = resolveScopeCompanyId({ tenancy: this.dependencies.config.tenancy, explicit: params.companyId })
    const page = params.page ?? DEFAULT_PAGE
    const perPage = params.perPage ?? DEFAULT_PER_PAGE

    const { rows, total } = await this.dependencies.users.list({ companyId, page, pageSize: perPage })
    const avatarUrls = await signAvatars({ dependencies: this.dependencies, rows })
    return toPaginatedUsers({ rows, total, page, perPage, ...(avatarUrls ? { avatarUrls } : {}) })
  }
}
