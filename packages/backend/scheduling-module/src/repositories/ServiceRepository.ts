/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import type { SchedulingDatabase } from '../database.types'
import {
  resourceServices,
  services,
  type NewResourceServiceRow,
  type NewServiceRow,
  type ServiceRow,
} from '../schema/schema'
import { serviceListCondition, serviceOwnedByCondition } from './conditions'

export type ListServicesQuery = {
  readonly companyId: string
  readonly page: number
  readonly pageSize: number
  readonly active?: boolean
}

export type ListServicesPage = {
  readonly rows: ServiceRow[]
  readonly total: number
}

export class ServiceRepository {
  constructor(private readonly db: SchedulingDatabase) {}

  async create(values: NewServiceRow): Promise<ServiceRow> {
    const [row] = await this.db.insert(services).values(values).returning()
    if (!row) throw new Error('scheduling-module: insert em services não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ServiceRow | undefined> {
    const [row] = await this.db.select().from(services).where(serviceOwnedByCondition(params)).limit(1)
    return row
  }

  async list(query: ListServicesQuery): Promise<ListServicesPage> {
    const conditions = [serviceListCondition(query)]
    if (query.active !== undefined) conditions.push(eq(services.active, query.active))

    const where = and(...conditions)

    const [rows, [counted]] = await Promise.all([
      this.db
        .select()
        .from(services)
        .where(where)
        .orderBy(asc(services.sortOrder), asc(services.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(services)
        .where(where),
    ])

    return { rows, total: counted?.value ?? 0 }
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewServiceRow>
  }): Promise<ServiceRow | undefined> {
    const [row] = await this.db
      .update(services)
      .set({ ...params.values, updatedAt: new Date() })
      .where(serviceOwnedByCondition(params))
      .returning()
    return row
  }

  async softDelete(params: { companyId: string; id: string }): Promise<boolean> {
    const [row] = await this.db
      .update(services)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(serviceOwnedByCondition(params))
      .returning({ id: services.id })
    return row !== undefined
  }

  /** Vínculo idempotente: reinserir o mesmo par não duplica, graças a `idx_resource_services_pair`. */
  async linkResource(values: NewResourceServiceRow): Promise<void> {
    await this.db.insert(resourceServices).values(values).onConflictDoNothing()
  }

  async unlinkResource(params: { companyId: string; resourceId: string; serviceId: string }): Promise<void> {
    await this.db
      .delete(resourceServices)
      .where(
        and(
          eq(resourceServices.companyId, params.companyId),
          eq(resourceServices.resourceId, params.resourceId),
          eq(resourceServices.serviceId, params.serviceId),
        ),
      )
  }

  /** Recursos que atendem o serviço — usado para filtrar a fatia de disponibilidade (spec §7). */
  async listResourceIdsForService(params: { companyId: string; serviceId: string }): Promise<string[]> {
    const rows = await this.db
      .select({ resourceId: resourceServices.resourceId })
      .from(resourceServices)
      .where(and(eq(resourceServices.companyId, params.companyId), eq(resourceServices.serviceId, params.serviceId)))
    return rows.map((row) => row.resourceId)
  }

  async listServiceIdsForResources(params: { companyId: string; resourceIds: string[] }): Promise<string[]> {
    if (params.resourceIds.length === 0) return []
    const rows = await this.db
      .select({ serviceId: resourceServices.serviceId })
      .from(resourceServices)
      .where(
        and(eq(resourceServices.companyId, params.companyId), inArray(resourceServices.resourceId, params.resourceIds)),
      )
    return [...new Set(rows.map((row) => row.serviceId))]
  }
}
