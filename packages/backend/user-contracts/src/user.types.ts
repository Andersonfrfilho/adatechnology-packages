/**
 * Copyright (c) 2026 Ada Technology. All rights reserved.
 *
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this file, via any medium, is
 * strictly prohibited without prior written permission from Ada Technology.
 */

export type UserProfile = {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly role: string // livre, sem enum — vocabulário é do host
  readonly companyId?: string // ausente em single-tenant
  readonly isActive: boolean
  readonly lastSeenAt?: Date
  /**
   * URL de leitura assinada, presente so quando ha foto E o host plugou armazenamento.
   *
   * Ausente cobre os dois casos porque a tela faz a mesma coisa nos dois: desenha as iniciais. Um
   * campo separado dizendo "tem foto, mas nao consigo servir" nao mudaria um pixel.
   */
  readonly avatarUrl?: string
}

export type UserSession = {
  readonly accessToken: string
  readonly expiresInSeconds: number
  readonly refreshToken: string
  readonly refreshExpiresInSeconds: number
  readonly user: UserProfile
}

export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated'

export type PaginatedResponse<T> = {
  readonly data: readonly T[]
  readonly pagination: {
    readonly total: number
    readonly page: number
    readonly perPage: number
  }
}

export type ListUsersParams = {
  readonly page?: number
  readonly perPage?: number
  readonly companyId?: string
}
