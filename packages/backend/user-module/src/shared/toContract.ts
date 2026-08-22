/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PaginatedResponse, UserProfile } from '@adatechnology/user-contracts'

import type { UserRow } from '../schema/schema'

export function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    ...(row.companyId ? { companyId: row.companyId } : {}),
    isActive: row.isActive,
    ...(row.lastSeenAt ? { lastSeenAt: row.lastSeenAt } : {}),
  }
}

export function toPaginatedUsers(params: {
  readonly rows: UserRow[]
  readonly total: number
  readonly page: number
  readonly perPage: number
}): PaginatedResponse<UserProfile> {
  return {
    data: params.rows.map(toUserProfile),
    pagination: { total: params.total, page: params.page, perPage: params.perPage },
  }
}
