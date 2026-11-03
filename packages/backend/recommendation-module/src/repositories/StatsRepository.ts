/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm'

import {
  RECOMMENDATION_EVENT,
  type CampaignStatsRow,
  type RecommendationEventType,
} from '@adatechnology/recommendation-contracts'

import type { RecommendationDatabase } from '../database.types'
import { NO_CAMPAIGN_ID, dailyStats, items } from '../schema/schema'

export class StatsRepository {
  constructor(private readonly db: RecommendationDatabase) {}

  private scope(companyId: string | undefined): SQL {
    return companyId === undefined ? isNull(dailyStats.companyId) : eq(dailyStats.companyId, companyId)
  }

  /**
   * Soma um ao contador do dia, numa instrução só. Ler e depois gravar perderia contagem com dois
   * cliques chegando juntos.
   */
  async increment(params: {
    readonly companyId: string | undefined
    readonly itemId: string
    readonly campaignId: string | null
    readonly placement: string
    readonly day: string
    readonly type: RecommendationEventType
  }): Promise<void> {
    const isClick = params.type === RECOMMENDATION_EVENT.CLICK
    await this.db
      .insert(dailyStats)
      .values({
        companyId: params.companyId ?? null,
        itemId: params.itemId,
        campaignId: params.campaignId ?? NO_CAMPAIGN_ID,
        placement: params.placement,
        day: params.day,
        impressions: isClick ? 0 : 1,
        clicks: isClick ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [dailyStats.itemId, dailyStats.campaignId, dailyStats.placement, dailyStats.day],
        set: isClick ? { clicks: sql`${dailyStats.clicks} + 1` } : { impressions: sql`${dailyStats.impressions} + 1` },
      })
  }

  async summarize(params: {
    readonly companyId: string | undefined
    readonly from: string
    readonly to: string
    readonly itemId?: string
    readonly sponsorId?: string
  }): Promise<CampaignStatsRow[]> {
    const conditions: SQL[] = [
      this.scope(params.companyId),
      gte(dailyStats.day, params.from),
      lte(dailyStats.day, params.to),
    ]
    if (params.itemId) conditions.push(eq(dailyStats.itemId, params.itemId))
    if (params.sponsorId) conditions.push(eq(items.sponsorId, params.sponsorId))

    const rows = await this.db
      .select({
        itemId: dailyStats.itemId,
        campaignId: dailyStats.campaignId,
        placement: dailyStats.placement,
        impressions: sql<number>`sum(${dailyStats.impressions})::int`,
        clicks: sql<number>`sum(${dailyStats.clicks})::int`,
      })
      .from(dailyStats)
      .innerJoin(items, eq(items.id, dailyStats.itemId))
      .where(and(...conditions))
      .groupBy(dailyStats.itemId, dailyStats.campaignId, dailyStats.placement)

    return rows.map((row) => ({
      itemId: row.itemId,
      campaignId: row.campaignId === NO_CAMPAIGN_ID ? null : row.campaignId,
      placement: row.placement,
      impressions: Number(row.impressions),
      clicks: Number(row.clicks),
    }))
  }
}
