/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'

import type { NotificationDatabase } from '../database.types'
import { suppressions, type SuppressionRow } from '../schema/schema'

export class SuppressionRepository {
  constructor(private readonly db: NotificationDatabase) {}

  /**
   * `targetHash` é HMAC do endereço (spec §5) — este método nunca recebe nem armazena o
   * endereço em claro; quem calcula o hash é a camada acima, com a chave injetada em `config`.
   */
  async isSuppressed(params: { companyId: string; channel: string; targetHash: string }): Promise<boolean> {
    const [row] = await this.db
      .select({ id: suppressions.id })
      .from(suppressions)
      .where(
        and(
          eq(suppressions.companyId, params.companyId),
          eq(suppressions.channel, params.channel),
          eq(suppressions.targetHash, params.targetHash),
          or(isNull(suppressions.expiresAt), gt(suppressions.expiresAt, sql`now()`)),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async create(params: {
    companyId: string
    channel: string
    targetHash: string
    reason: string
    expiresAt?: Date
  }): Promise<SuppressionRow> {
    const [row] = await this.db
      .insert(suppressions)
      .values(params)
      .onConflictDoUpdate({
        target: [suppressions.companyId, suppressions.channel, suppressions.targetHash],
        set: { reason: params.reason, expiresAt: params.expiresAt },
      })
      .returning()
    if (!row) throw new Error('notification-module: upsert em suppressions não retornou linha')
    return row
  }
}
