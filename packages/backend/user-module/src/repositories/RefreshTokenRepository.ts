/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Default do `RefreshTokenStorePort` — o host pode injetar outro (ex: Redis) via `providers`.
 */

import { and, eq, gt } from 'drizzle-orm'
import type { RefreshTokenStorePort } from '@adatechnology/user-contracts'

import type { UserDatabase } from '../database.types'
import { refreshTokens } from '../schema/schema'
import { generateRawToken, hashToken } from '../shared/tokenHash'

export class RefreshTokenRepository implements RefreshTokenStorePort {
  constructor(private readonly db: UserDatabase) {}

  async issue(params: { userId: string; expiresInSeconds: number }): Promise<string> {
    const rawToken = generateRawToken()
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000)
    await this.db.insert(refreshTokens).values({ tokenHash: hashToken(rawToken), userId: params.userId, expiresAt })
    return rawToken
  }

  /**
   * `DELETE ... RETURNING` é a metade atômica: duas rotações simultâneas do mesmo token só uma
   * encontra a linha para apagar — a outra recebe `null`, nunca uma sessão fantasma duplicada.
   */
  async rotate(params: {
    tokenHash: string
    newExpiresInSeconds: number
  }): Promise<{ token: string; userId: string } | null> {
    const [deleted] = await this.db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, params.tokenHash), gt(refreshTokens.expiresAt, new Date())))
      .returning({ userId: refreshTokens.userId })

    if (!deleted) return null
    const token = await this.issue({ userId: deleted.userId, expiresInSeconds: params.newExpiresInSeconds })
    return { token, userId: deleted.userId }
  }

  async revoke(params: { tokenHash: string }): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, params.tokenHash))
  }

  async revokeAllForUser(params: { userId: string }): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, params.userId))
  }
}
