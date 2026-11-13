/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, desc, eq, isNull, type SQL } from 'drizzle-orm'

import type { RecommendationDatabase } from '../database.types'
import { campaigns, type CampaignRow, type NewCampaignRow } from '../schema/schema'

export class CampaignRepository {
  constructor(private readonly db: RecommendationDatabase) {}

  private scope(companyId: string | undefined): SQL {
    return companyId === undefined ? isNull(campaigns.companyId) : eq(campaigns.companyId, companyId)
  }

  async insert(values: NewCampaignRow): Promise<CampaignRow> {
    const [row] = await this.db.insert(campaigns).values(values).returning()
    if (!row) throw new Error('recommendation-module: insert de campanha não devolveu linha')
    return row
  }

  async update(params: {
    readonly companyId: string | undefined
    readonly id: string
    readonly values: Partial<NewCampaignRow>
  }): Promise<CampaignRow | undefined> {
    const [row] = await this.db
      .update(campaigns)
      .set({ ...params.values, updatedAt: new Date() })
      .where(and(eq(campaigns.id, params.id), this.scope(params.companyId)))
      .returning()
    return row
  }

  async findById(params: {
    readonly companyId: string | undefined
    readonly id: string
  }): Promise<CampaignRow | undefined> {
    const [row] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, params.id), this.scope(params.companyId)))
      .limit(1)
    return row
  }

  async listByItem(params: {
    readonly companyId: string | undefined
    readonly itemId: string
  }): Promise<CampaignRow[]> {
    return this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.itemId, params.itemId), this.scope(params.companyId)))
      .orderBy(desc(campaigns.startsAt))
  }
}
