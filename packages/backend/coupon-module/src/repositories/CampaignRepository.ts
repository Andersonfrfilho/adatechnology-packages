/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { REDEMPTION_STATUS, type CampaignStats, type ListCampaignsQuery } from '@adatechnology/coupon-contracts'
import { and, asc, count, desc, eq, inArray, sum } from 'drizzle-orm'

import type { CouponDatabase } from '../database.types'
import { campaigns, leads, redemptions, type CampaignRow, type NewCampaignRow } from '../schema/schema'
import type { CampaignStorePort, Page } from '../use-cases/couponModule.types'
import {
  campaignActivityConditions,
  campaignListCondition,
  campaignOpenCondition,
  campaignOwnedCondition,
} from './conditions'

const SORT_COLUMNS = {
  createdAt: campaigns.createdAt,
  updatedAt: campaigns.updatedAt,
  name: campaigns.name,
  startsAt: campaigns.startsAt,
  endsAt: campaigns.endsAt,
} as const

export class CampaignRepository implements CampaignStorePort {
  constructor(private readonly db: CouponDatabase) {}

  async create(values: NewCampaignRow): Promise<CampaignRow> {
    const [row] = await this.db.insert(campaigns).values(values).returning()
    if (!row) throw new Error('coupons: INSERT de campanha sem retorno')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<CampaignRow | undefined> {
    const [row] = await this.db.select().from(campaigns).where(campaignOwnedCondition(params)).limit(1)
    return row
  }

  async lockById(params: { companyId: string; id: string }): Promise<CampaignRow | undefined> {
    const [row] = await this.db.select().from(campaigns).where(campaignOwnedCondition(params)).limit(1).for('update')
    return row
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewCampaignRow>
  }): Promise<CampaignRow | undefined> {
    const [row] = await this.db.update(campaigns).set(params.values).where(campaignOwnedCondition(params)).returning()
    return row
  }

  async remove(params: { companyId: string; id: string }): Promise<boolean> {
    const rows = await this.db.delete(campaigns).where(campaignOwnedCondition(params)).returning({ id: campaigns.id })
    return rows.length > 0
  }

  async list(params: ListCampaignsQuery & { companyId: string; now: Date }): Promise<Page<CampaignRow>> {
    const where = campaignListCondition({
      companyId: params.companyId,
      search: params.search,
      states: params.state,
      now: params.now,
    })
    const column = SORT_COLUMNS[params.sort]
    const order = params.order === 'asc' ? asc(column) : desc(column)
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(campaigns)
        .where(where)
        .orderBy(order, asc(campaigns.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(campaigns).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async stats(params: {
    companyId: string
    campaignIds: readonly string[]
  }): Promise<ReadonlyMap<string, CampaignStats>> {
    const result = new Map<string, CampaignStats>()
    if (params.campaignIds.length === 0) return result
    const ids = [...params.campaignIds]
    const [used, captured] = await Promise.all([
      this.db
        .select({ campaignId: redemptions.campaignId, total: count(), discount: sum(redemptions.discountCents) })
        .from(redemptions)
        .where(
          and(
            eq(redemptions.companyId, params.companyId),
            eq(redemptions.status, REDEMPTION_STATUS.REDEEMED),
            inArray(redemptions.campaignId, ids),
          ),
        )
        .groupBy(redemptions.campaignId),
      this.db
        .select({ campaignId: leads.campaignId, total: count() })
        .from(leads)
        .where(and(eq(leads.companyId, params.companyId), inArray(leads.campaignId, ids)))
        .groupBy(leads.campaignId),
    ])
    for (const id of ids) {
      const usage = used.find((row) => row.campaignId === id)
      result.set(id, {
        redemptionCount: usage?.total ?? 0,
        discountCents: Number(usage?.discount ?? 0),
        leadCount: captured.find((row) => row.campaignId === id)?.total ?? 0,
      })
    }
    return result
  }

  listOpenAutomatic(params: { companyId: string; now: Date }): Promise<CampaignRow[]> {
    return this.db
      .select()
      .from(campaigns)
      .where(campaignOpenCondition({ ...params, automaticOnly: true }))
  }

  listOpen(params: { companyId: string; now: Date }): Promise<CampaignRow[]> {
    return this.db
      .select()
      .from(campaigns)
      .where(campaignOpenCondition({ ...params, automaticOnly: false }))
      .orderBy(desc(campaigns.createdAt))
  }

  async hasActivity(params: { companyId: string; id: string }): Promise<boolean> {
    const conditions = campaignActivityConditions(params)
    const [redeemed] = await this.db
      .select({ id: redemptions.id })
      .from(redemptions)
      .where(conditions.redemptions)
      .limit(1)
    if (redeemed) return true
    const [captured] = await this.db.select({ id: leads.id }).from(leads).where(conditions.leads).limit(1)
    return captured !== undefined
  }
}
