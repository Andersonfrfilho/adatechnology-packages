/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { UserDatabase } from '../database.types'
import { users, type NewUserRow, type UserRow } from '../schema/schema'
import {
  userByEmailCondition,
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

export class UserRepository {
  constructor(private readonly db: UserDatabase) {}

  async create(values: NewUserRow): Promise<UserRow> {
    const [row] = await this.db.insert(users).values(values).returning()
    if (!row) throw new Error('user-module: insert em users não retornou linha')
    return row
  }

  async findById(params: { companyId: string | undefined; id: string }): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(userOwnedByCondition(params)).limit(1)
    return row
  }

  async findByEmail(params: { companyId: string | undefined; email: string }): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(userByEmailCondition(params)).limit(1)
    return row
  }

  async findByProviderExternalId(params: {
    companyId: string | undefined
    providerId: string
    externalId: string
  }): Promise<UserRow | undefined> {
    const [row] = await this.db.select().from(users).where(userByProviderExternalCondition(params)).limit(1)
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
      .where(userOwnedByCondition(params))
      .returning()
    return row
  }

  /**
   * Leitura sem escopo de tenant: usada quando a autorização já foi provada por outro meio (posse
   * de refresh token) e não há `companyId` confiável disponível no chamador.
   */
  async findByIdUnscoped(params: { id: string }): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, params.id), isNull(users.deletedAt)))
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
      .where(and(eq(users.id, params.id), isNull(users.deletedAt)))
      .returning()
    return row
  }

  async list(query: ListUsersQuery): Promise<ListUsersPage> {
    const where = userListCondition(query)

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
