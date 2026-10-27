/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PaginatedResponse, UserProfile } from '@adatechnology/user-contracts'

import type { UserRow } from '../schema/schema'

export type ToUserProfileParams = {
  readonly row: UserRow
  /** Ja assinada por quem chamou; o mapeamento e sincrono e nao conhece armazenamento. */
  readonly avatarUrl?: string
}

export function toUserProfile(row: UserRow, avatarUrl?: string): UserProfile {
  return {
    ...(avatarUrl ? { avatarUrl } : {}),
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
  /** Chave -> URL assinada, resolvido em lote antes de mapear. Ausente = sem armazenamento. */
  readonly avatarUrls?: ReadonlyMap<string, string>
}): PaginatedResponse<UserProfile> {
  return {
    data: params.rows.map((row) =>
      toUserProfile(row, row.avatarKey ? params.avatarUrls?.get(row.avatarKey) : undefined),
    ),
    pagination: { total: params.total, page: params.page, perPage: params.perPage },
  }
}
