/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Default do `RefreshTokenStorePort` — o host pode injetar outro (ex: Redis) via `providers`.
 */

import { and, eq, gt, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { RefreshRotationResult, RefreshTokenStorePort } from '@adatechnology/user-contracts'

import type { UserDatabase } from '../database.types'
import { refreshTokens } from '../schema/schema'
import { DEFAULT_REFRESH_REUSE_GRACE_SECONDS } from '../shared/constants'
import { generateRawToken, hashToken } from '../shared/tokenHash'

export class RefreshTokenRepository implements RefreshTokenStorePort {
  constructor(private readonly db: UserDatabase) {}

  async issue(params: {
    userId: string
    expiresInSeconds: number
    rememberMe?: boolean
    sessionStartedAt?: Date
  }): Promise<string> {
    const rawToken = generateRawToken()
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000)
    await this.db.insert(refreshTokens).values({
      tokenHash: hashToken(rawToken),
      userId: params.userId,
      expiresAt,
      rememberMe: params.rememberMe ?? null,
      ...(params.sessionStartedAt ? { sessionStartedAt: params.sessionStartedAt } : {}),
    })
    return rawToken
  }

  /**
   * O `UPDATE ... SET revoked_at WHERE revoked_at IS NULL AND expires_at > now RETURNING` é a metade
   * atômica: duas rotações simultâneas do mesmo token só uma encontra a linha ainda não revogada.
   *
   * A linha rotacionada **fica** como marcador. Quando a perdedora (ou um atacante com o token
   * antigo) chega depois, achar o marcador é a prova de reuso: todas as sessões do usuário são
   * revogadas. Dentro de `reuseGraceSeconds` do marcador o caso é tratado como corrida honesta
   * (duas abas renovando juntas) e só recusa, sem derrubar nada.
   */
  async rotate(params: Parameters<RefreshTokenStorePort['rotate']>[0]): Promise<RefreshRotationResult> {
    const now = new Date()
    const absolute = params.absoluteExpiresInSeconds

    const [rotated] = await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.tokenHash, params.tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
          // `Date` cru em `sql` o postgres-js não serializa (ERR_INVALID_ARG_TYPE): vai como ISO tipado.
          // Passado o teto absoluto a linha nem casa: a sessão acabou e fica sem marcador de rotação —
          // reapresentar o cookie depois nunca vira "reuso" que derrubaria as outras sessões da pessoa.
          absolute === undefined
            ? undefined
            : sql`${refreshTokens.sessionStartedAt} + make_interval(secs => ${absolute}::double precision) > ${now.toISOString()}::timestamptz`,
        ),
      )
      .returning({
        userId: refreshTokens.userId,
        rememberMe: refreshTokens.rememberMe,
        sessionStartedAt: refreshTokens.sessionStartedAt,
      })

    if (rotated) return this.issueRotated({ rotated, params, now })

    const [marker] = await this.db
      .select({ userId: refreshTokens.userId, revokedAt: refreshTokens.revokedAt })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, params.tokenHash),
          isNotNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .limit(1)
    if (!marker?.revokedAt) return null

    const graceSeconds = params.reuseGraceSeconds ?? DEFAULT_REFRESH_REUSE_GRACE_SECONDS
    if (now.getTime() - marker.revokedAt.getTime() < graceSeconds * 1000) return null

    await this.revokeAllForUser({ userId: marker.userId })
    return { reusedForUserId: marker.userId }
  }

  /**
   * A escolha registrada no token vence a do cookie (que é só dica para token anterior ao registro), e é
   * herdada pelo token novo. A validade nunca passa do teto absoluto.
   */
  private async issueRotated(args: {
    rotated: { userId: string; rememberMe: boolean | null; sessionStartedAt: Date }
    params: Parameters<RefreshTokenStorePort['rotate']>[0]
    now: Date
  }): Promise<{ token: string; userId: string; rememberMe?: boolean; expiresInSeconds: number }> {
    const { rotated, params, now } = args
    const rememberMe = rotated.rememberMe ?? params.rememberMeHint
    const byChoice = params.expiresInSecondsByChoice
    const lifetimeSeconds =
      rememberMe === undefined || !byChoice
        ? params.newExpiresInSeconds
        : rememberMe
          ? byChoice.remember
          : byChoice.session
    const absolute = params.absoluteExpiresInSeconds
    const remainingSeconds =
      absolute === undefined
        ? Number.POSITIVE_INFINITY
        : absolute - (now.getTime() - rotated.sessionStartedAt.getTime()) / 1000
    const expiresInSeconds = Math.max(1, Math.floor(Math.min(lifetimeSeconds, remainingSeconds)))

    const token = await this.issue({
      userId: rotated.userId,
      expiresInSeconds,
      ...(rememberMe === undefined ? {} : { rememberMe }),
      sessionStartedAt: rotated.sessionStartedAt,
    })
    return { token, userId: rotated.userId, ...(rememberMe === undefined ? {} : { rememberMe }), expiresInSeconds }
  }

  /** Logout apaga a linha: reapresentar o cookie de uma sessão encerrada é recusa simples, não reuso. */
  async revoke(params: { tokenHash: string }): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, params.tokenHash))
  }

  async revokeAllForUser(params: { userId: string }): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, params.userId))
  }

  /** Rotina de limpeza do host: expirados e marcadores vencidos não servem mais a ninguém. */
  async deleteExpired(params: { now: Date }): Promise<void> {
    await this.db.delete(refreshTokens).where(lte(refreshTokens.expiresAt, params.now))
  }
}
