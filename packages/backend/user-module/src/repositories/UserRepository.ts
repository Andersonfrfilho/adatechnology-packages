/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, isNull, lte, or, sql } from 'drizzle-orm'
import { DEFAULT_USER_AUDIENCE } from '@adatechnology/user-contracts'

import type { UserDatabase } from '../database.types'
import { users, type NewUserRow, type UserRow } from '../schema/schema'
import {
  userByEmailCondition,
  userByIdInAudienceCondition,
  userByProviderExternalCondition,
  userListCondition,
  userOwnedByCondition,
} from './conditions'

export type ListUsersQuery = {
  readonly companyId: string | undefined
  readonly page: number
  readonly pageSize: number
}

export type ListUsersPage = {
  readonly rows: UserRow[]
  readonly total: number
}

export type RegisterFailedLoginParams = {
  readonly id: string
  readonly now: Date
  readonly maxFailedAttempts: number
  readonly lockMinutes: number
}

export type RegisterFailedLoginResult = {
  readonly failedLoginAttempts: number
  readonly lockedUntil: Date | null
  /** `true` só na tentativa que cruzou o limite — é o que dispara o evento de bloqueio, uma vez. */
  readonly didLock: boolean
}

/**
 * Toda operação fica presa à audiência da instância (`audience`, padrão `default`). O tenant segue
 * sendo passado por chamada, como sempre.
 */
export class UserRepository {
  constructor(
    private readonly db: UserDatabase,
    private readonly audience: string = DEFAULT_USER_AUDIENCE,
  ) {}

  async create(values: NewUserRow): Promise<UserRow> {
    const [row] = await this.db
      .insert(users)
      .values({ ...values, audience: this.audience })
      .returning()
    if (!row) throw new Error('user-module: insert em users não retornou linha')
    return row
  }

  async findById(params: { companyId: string | undefined; id: string }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(userOwnedByCondition({ ...params, audience: this.audience }))
      .limit(1)
    return row
  }

  async findByEmail(params: { companyId: string | undefined; email: string }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(userByEmailCondition({ ...params, audience: this.audience }))
      .limit(1)
    return row
  }

  async findByProviderExternalId(params: {
    companyId: string | undefined
    providerId: string
    externalId: string
  }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(userByProviderExternalCondition({ ...params, audience: this.audience }))
      .limit(1)
    return row
  }

  async update(params: {
    companyId: string | undefined
    id: string
    values: Partial<NewUserRow>
  }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ ...params.values, updatedAt: new Date() })
      .where(userOwnedByCondition({ companyId: params.companyId, id: params.id, audience: this.audience }))
      .returning()
    return row
  }

  /**
   * Leitura sem escopo de tenant: usada quando a autorização já foi provada por outro meio (posse
   * de refresh token) e não há `companyId` confiável disponível no chamador. Continua presa à
   * audiência: um refresh token emitido por outra audiência não abre sessão aqui.
   */
  async findByIdUnscoped(params: { id: string }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(userByIdInAudienceCondition({ audience: this.audience, id: params.id }))
      .limit(1)
    return row
  }

  /**
   * Atualização sem escopo de tenant: usada quando a autorização já foi provada por outro meio
   * (posse de token de reset de senha) e não há `companyId` confiável disponível no chamador.
   */
  async updateById(params: { id: string; values: Partial<NewUserRow> }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ ...params.values, updatedAt: new Date() })
      .where(userByIdInAudienceCondition({ audience: this.audience, id: params.id }))
      .returning()
    return row
  }

  /**
   * Conta a falha e decide o bloqueio num único `UPDATE ... RETURNING`: sem ler antes de escrever,
   * duas tentativas simultâneas somam as duas, e só uma cruza o limite.
   *
   * Bloqueio vencido recomeça o contador em 1. Conta já bloqueada não conta de novo (a cláusula
   * `WHERE` a ignora), então o prazo não se estende por tentativa de quem está de fora.
   * `now` vem do relógio do módulo e não do `now()` do banco para o teste controlar o tempo.
   */
  async registerFailedLogin(params: RegisterFailedLoginParams): Promise<RegisterFailedLoginResult | undefined> {
    const nowValue = sql`${params.now.toISOString()}::timestamptz`
    const isExpiredLock = sql`(${users.lockedUntil} is not null and ${users.lockedUntil} <= ${nowValue})`
    const nextAttempts = sql`(case when ${isExpiredLock} then 1 else ${users.failedLoginAttempts} + 1 end)`
    const lockedUntil = new Date(params.now.getTime() + params.lockMinutes * 60_000).toISOString()

    const [row] = await this.db
      .update(users)
      .set({
        failedLoginAttempts: sql`${nextAttempts}`,
        lockedUntil: sql`(case when ${nextAttempts} >= ${params.maxFailedAttempts}::int then ${lockedUntil}::timestamptz else null end)`,
      })
      .where(
        and(
          userByIdInAudienceCondition({ audience: this.audience, id: params.id }),
          or(isNull(users.lockedUntil), lte(users.lockedUntil, params.now)),
        ),
      )
      .returning({ failedLoginAttempts: users.failedLoginAttempts, lockedUntil: users.lockedUntil })

    if (!row) return undefined
    return {
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil,
      didLock: row.lockedUntil !== null && row.failedLoginAttempts >= params.maxFailedAttempts,
    }
  }

  /**
   * Login bem-sucedido: zera o contador e carimba `last_seen_at`, mas só se a conta não estiver
   * bloqueada **agora**. O `WHERE` fecha a corrida em que o bloqueio entra entre a leitura da
   * senha e esta escrita — `undefined` significa "bloqueada", e o chamador recusa o login.
   */
  async registerSuccessfulLogin(params: { id: string; now: Date }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastSeenAt: params.now, updatedAt: params.now })
      .where(
        and(
          userByIdInAudienceCondition({ audience: this.audience, id: params.id }),
          or(isNull(users.lockedUntil), lte(users.lockedUntil, params.now)),
        ),
      )
      .returning()
    return row
  }

  async list(query: ListUsersQuery): Promise<ListUsersPage> {
    const where = userListCondition({ companyId: query.companyId, audience: this.audience })

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(asc(users.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
    ])

    return { rows, total: counted?.value ?? 0 }
  }
}
