/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, sql } from 'drizzle-orm'

import type { SchedulingDatabase } from '../database.types'
import { resources, type NewResourceRow, type ResourceRow } from '../schema/schema'
import { resourceListCondition, resourceOwnedByCondition } from './conditions'

export type ListResourcesQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly kind?: string
  readonly active?: boolean
}

export type ListResourcesPage = {
  readonly rows: ResourceRow[]
  readonly total: number
}

export class ResourceRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  async create(values: NewResourceRow): Promise<ResourceRow> {
    const [row] = await this.db.insert(resources).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em resources não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ResourceRow | undefined> {
    const [row] = await this.db.select().from(resources).where(resourceOwnedByCondition(params)).limit(1)
    return row
  }

  async list(query: ListResourcesQuery): Promise<ListResourcesPage> {
    const conditions = [resourceListCondition(query)]
    if (query.kind) conditions.push(eq(resources.kind, query.kind))
    if (query.active !== undefined) conditions.push(eq(resources.active, query.active))

    const where = and(...conditions)

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(resources)
        .where(where)
        .orderBy(asc(resources.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(resources)
        .where(where),
    ])

    return { rows, total: counted?.value ?? 0 }
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewResourceRow>
  }): Promise<ResourceRow | undefined> {
    const [row] = await this.db
      .update(resources)
      .set({ ...params.values, updatedAt: new Date() })
      .where(resourceOwnedByCondition(params))
      .returning()
    return row
  }

  async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .update(resources)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(resourceOwnedByCondition(params))
      .returning({ id: resources.id })
    return row !== undefined
  }
}
