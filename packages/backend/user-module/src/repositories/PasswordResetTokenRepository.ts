/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, gt, isNull, sql } from 'drizzle-orm'

import type { UserDatabase } from '../database.types'
import { passwordResetTokens, type NewPasswordResetTokenRow, type PasswordResetTokenRow } from '../schema/schema'

export class PasswordResetTokenRepository {
  constructor(private readonly db: UserDatabase) {}

  async create(values: NewPasswordResetTokenRow): Promise<PasswordResetTokenRow> {
    const [row] = await this.db.insert(passwordResetTokens).values(values).returning()
    if (!row) throw new Error('user-module: insert em password_reset_tokens não retornou linha')
    return row
  }

  /**
   * Confirmação **atômica**: a condição de validade (não consumido, dentro do prazo) vive no
   * próprio `UPDATE`, e o resultado é decidido pela linha afetada — mesmo idioma do
   * `UPDATE ... WHERE inventory >= quantity` do `catalog-module`. Duas confirmações simultâneas
   * do mesmo token nunca resolvem as duas: a segunda não encontra linha para atualizar.
   */
  async confirmAndConsume(params: { tokenHash: string; now: Date }): Promise<{ userId: string } | undefined> {
    const [row] = await this.db
      .update(passwordResetTokens)
      .set({ consumedAt: params.now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, params.tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, params.now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId })
    return row
  }

  /** Só para o `use-case` distinguir "não existe"/"expirado" de "já usado" ao montar o erro certo. */
  async findByHash(params: { tokenHash: string }): Promise<PasswordResetTokenRow | undefined> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, params.tokenHash))
      .limit(1)
    return row
  }

  /** Higiene de dados: tokens vencidos não crescem a tabela para sempre. Não é rota exposta. */
  async deleteExpired(params: { now: Date }): Promise<number> {
    const rows = await this.db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < ${params.now}`)
      .returning({ id: passwordResetTokens.id })
    return rows.length
  }
}
