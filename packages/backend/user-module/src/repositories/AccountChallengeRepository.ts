/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'

import type { UserDatabase } from '../database.types'
import { accountChallenges, type AccountChallengeRow } from '../schema/schema'

export const ACCOUNT_CHALLENGE_KIND = { EMAIL_CHANGE: 'email_change', PHONE_CODE: 'phone_code' } as const
export type AccountChallengeKind = (typeof ACCOUNT_CHALLENGE_KIND)[keyof typeof ACCOUNT_CHALLENGE_KIND]

export type IssueChallengeParams = {
  readonly userId: string
  readonly kind: AccountChallengeKind
  readonly secretHash: string
  readonly target: string
  readonly expiresAt: Date
  readonly now: Date
}

/** Só o hash do segredo é gravado; um desafio novo do mesmo tipo invalida o pendente da mesma pessoa. */
export class AccountChallengeRepository {
  constructor(private readonly db: UserDatabase) {}

  async issue(params: IssueChallengeParams): Promise<AccountChallengeRow> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .update(accountChallenges)
        .set({ consumedAt: params.now })
        .where(
          and(
            eq(accountChallenges.userId, params.userId),
            eq(accountChallenges.kind, params.kind),
            isNull(accountChallenges.consumedAt),
          ),
        )
      const [row] = await transaction
        .insert(accountChallenges)
        .values({
          userId: params.userId,
          kind: params.kind,
          secretHash: params.secretHash,
          target: params.target,
          expiresAt: params.expiresAt,
          createdAt: params.now,
        })
        .returning()
      if (!row) throw new Error('user-module: insert em account_challenges não retornou linha')
      return row
    })
  }

  /** Atômico: a validade vive no `UPDATE`, então dois cliques no mesmo link nunca resolvem os dois. */
  async consumeBySecret(params: {
    kind: AccountChallengeKind
    secretHash: string
    now: Date
  }): Promise<{ userId: string; target: string } | undefined> {
    const [row] = await this.db
      .update(accountChallenges)
      .set({ consumedAt: params.now })
      .where(
        and(
          eq(accountChallenges.kind, params.kind),
          eq(accountChallenges.secretHash, params.secretHash),
          isNull(accountChallenges.consumedAt),
          gt(accountChallenges.expiresAt, params.now),
        ),
      )
      .returning({ userId: accountChallenges.userId, target: accountChallenges.target })
    return row
  }

  async findLatest(params: { userId: string; kind: AccountChallengeKind }): Promise<AccountChallengeRow | undefined> {
    const [row] = await this.db
      .select()
      .from(accountChallenges)
      .where(and(eq(accountChallenges.userId, params.userId), eq(accountChallenges.kind, params.kind)))
      .orderBy(desc(accountChallenges.createdAt))
      .limit(1)
    return row
  }

  /** Conta a tentativa e devolve o total — num único `UPDATE`, sem ler antes de escrever. */
  async registerAttempt(params: { id: string }): Promise<number | undefined> {
    const [row] = await this.db
      .update(accountChallenges)
      .set({ attempts: sql`${accountChallenges.attempts} + 1` })
      .where(and(eq(accountChallenges.id, params.id), isNull(accountChallenges.consumedAt)))
      .returning({ attempts: accountChallenges.attempts })
    return row?.attempts
  }

  async consume(params: { id: string; now: Date }): Promise<boolean> {
    const rows = await this.db
      .update(accountChallenges)
      .set({ consumedAt: params.now })
      .where(and(eq(accountChallenges.id, params.id), isNull(accountChallenges.consumedAt)))
      .returning({ id: accountChallenges.id })
    return rows.length === 1
  }
}
