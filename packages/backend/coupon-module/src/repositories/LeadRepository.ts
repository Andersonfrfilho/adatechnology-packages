/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ListLeadsQuery } from '@adatechnology/coupon-contracts'
import { and, asc, count, desc, eq, gte } from 'drizzle-orm'

import type { CouponDatabase } from '../database.types'
import { leads, type LeadRow, type NewLeadRow } from '../schema/schema'
import type { LeadStorePort, Page } from '../use-cases/couponModule.types'
import { leadContactCondition, leadListCondition, leadOwnedCondition } from './conditions'

const SORT_COLUMNS = { createdAt: leads.createdAt, name: leads.name, email: leads.email } as const

export class LeadRepository implements LeadStorePort {
  constructor(private readonly db: CouponDatabase) {}

  /** `ON CONFLICT DO NOTHING`: o índice único por telefone/e-mail decide a corrida sem abortar a transação. */
  async insert(values: NewLeadRow): Promise<LeadRow | undefined> {
    const [row] = await this.db.insert(leads).values(values).onConflictDoNothing().returning()
    return row
  }

  async findByContact(params: {
    companyId: string
    campaignId: string
    phone: string | null
    email: string | null
  }): Promise<LeadRow | undefined> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(leadContactCondition(params))
      .orderBy(asc(leads.createdAt))
      .limit(1)
    return row
  }

  async update(params: { companyId: string; id: string; values: Partial<NewLeadRow> }): Promise<LeadRow | undefined> {
    const [row] = await this.db.update(leads).set(params.values).where(leadOwnedCondition(params)).returning()
    return row
  }

  async list(params: ListLeadsQuery & { companyId: string; campaignId: string }): Promise<Page<LeadRow>> {
    const where = leadListCondition(params)
    const column = SORT_COLUMNS[params.sort]
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(leads)
        .where(where)
        .orderBy(params.order === 'asc' ? asc(column) : desc(column), asc(leads.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(leads).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async count(params: { companyId: string; campaignId: string }): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(leads)
      .where(and(eq(leads.companyId, params.companyId), eq(leads.campaignId, params.campaignId)))
    return row?.total ?? 0
  }

  async countSince(params: { companyId: string; campaignId: string; since: Date }): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(leads)
      .where(
        and(
          eq(leads.companyId, params.companyId),
          eq(leads.campaignId, params.campaignId),
          gte(leads.createdAt, params.since),
        ),
      )
    return row?.total ?? 0
  }

  async anonymise(params: { companyId: string; campaignId: string; leadId: string }): Promise<LeadRow | undefined> {
    const [row] = await this.db
      .update(leads)
      .set({ name: null, phone: null, email: null, customerRef: null, couponCode: null })
      .where(
        and(
          leadOwnedCondition({ companyId: params.companyId, id: params.leadId }),
          eq(leads.campaignId, params.campaignId),
        ),
      )
      .returning()
    return row
  }
}
