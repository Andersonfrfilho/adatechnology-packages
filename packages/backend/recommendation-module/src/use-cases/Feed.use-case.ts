/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CampaignNotFoundError,
  DEFAULT_FEED_LIMIT,
  DEFAULT_MAX_SPONSORED_PER_FEED,
  ITEM_STATUS,
  ItemNotFoundError,
  type CampaignStatsRow,
  type Feed,
  type FeedQuery,
  type StatsQuery,
  type TrackEventInput,
} from '@adatechnology/recommendation-contracts'

import { rankFeed, type SponsoredCandidate } from '../domain/rankFeed'
import { toCampaign, toFeedEntry, toItem } from '../shared/mappers'
import { dayIn, placementOf, scopeArg, type UseCaseContext } from './context'

type Scoped = { readonly companyId?: string }

export class GetFeedUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly query: FeedQuery }): Promise<Feed> {
    const { config } = this.context
    const { query } = params
    const placement = placementOf(config, query.placement)
    const limit = query.limit ?? config.defaultFeedLimit ?? DEFAULT_FEED_LIMIT
    const maxSponsored = placement.maxSponsored ?? config.maxSponsoredPerFeed ?? DEFAULT_MAX_SPONSORED_PER_FEED
    const now = this.context.clock.now()

    const audience = {
      companyId: params.companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.city ? { city: query.city } : {}),
      ...(query.age !== undefined ? { age: query.age } : {}),
    }

    const [sponsoredRows, curatedRows] = await Promise.all([
      maxSponsored > 0
        ? this.context.items.sponsoredCandidates({ ...audience, placement: placement.name, now })
        : Promise.resolve([]),
      this.context.items.curatedCandidates(audience),
    ])

    const weightByPlan = new Map(config.plans.map((plan) => [plan.name, plan.weight]))
    const entitled = await this.entitledPairs(
      sponsoredRows.map((row) => ({ sponsorId: row.item.sponsorId, plan: row.campaign.plan })),
      params.companyId,
      now,
    )

    const sponsored: SponsoredCandidate[] = []
    for (const row of sponsoredRows) {
      const weight = weightByPlan.get(row.campaign.plan)
      // Plano que saiu da configuração não vende mais nada: a campanha fica no banco, fora do ar.
      if (weight === undefined) continue
      if (!entitled.has(pairKey(row.item.sponsorId, row.campaign.plan))) continue
      const campaign = toCampaign(row.campaign)
      sponsored.push({
        entry: toFeedEntry(toItem(row.item), campaign),
        planWeight: weight,
        priority: campaign.priority,
      })
    }

    const entries = rankFeed({
      sponsored,
      curated: curatedRows.map((row) => {
        const item = toItem(row)
        return { entry: toFeedEntry(item, null), updatedAt: item.updatedAt }
      }),
      limit,
      maxSponsored,
      ...(query.tags ? { tags: query.tags } : {}),
      random: () => this.context.random.next(),
    })

    return { placement: placement.name, entries }
  }

  /**
   * Pergunta à cobrança UMA vez por par anunciante+plano. Sem porta, todos estão liberados.
   *
   * Falha da porta tira o anúncio do ar em vez de mostrá-lo de graça, e não derruba o feed: a
   * curadoria continua aparecendo.
   */
  private async entitledPairs(
    pairs: readonly { readonly sponsorId: string | null; readonly plan: string }[],
    companyId: string | undefined,
    now: Date,
  ): Promise<Set<string>> {
    const unique = new Map(pairs.map((pair) => [pairKey(pair.sponsorId, pair.plan), pair]))
    const port = this.context.entitlement
    if (!port) return new Set(unique.keys())

    const allowed = new Set<string>()
    await Promise.all(
      [...unique.entries()].map(async ([key, pair]) => {
        if (!pair.sponsorId) return
        try {
          const ok = await port.isEntitled({
            sponsorId: pair.sponsorId,
            plan: pair.plan,
            at: now,
            ...scopeArg(companyId),
          })
          if (ok) allowed.add(key)
        } catch (error) {
          this.context.logger?.error('recommendation.entitlement.failed', {
            plan: pair.plan,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }),
    )
    return allowed
  }
}

function pairKey(sponsorId: string | null, plan: string): string {
  return `${sponsorId ?? '-'}:${plan}`
}

/**
 * Impressão e clique. O host deve limitar a taxa desta rota: contador público é contador que se
 * infla, e o módulo não tem como distinguir pessoa de robô.
 */
export class TrackEventUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly input: TrackEventInput }): Promise<void> {
    const { input } = params
    placementOf(this.context.config, input.placement)

    const item = await this.context.items.findById({ companyId: params.companyId, id: input.itemId })
    if (!item || item.status !== ITEM_STATUS.ACTIVE) throw new ItemNotFoundError()

    const campaignId = input.campaignId ?? null
    if (campaignId) {
      const campaign = await this.context.campaigns.findById({ companyId: params.companyId, id: campaignId })
      if (!campaign || campaign.itemId !== item.id) throw new CampaignNotFoundError()
    }

    await this.context.stats.increment({
      companyId: params.companyId,
      itemId: item.id,
      campaignId,
      placement: input.placement,
      day: dayIn(this.context.clock.now(), this.context.config.timeZone ?? 'UTC'),
      type: input.type,
    })
  }
}

export class GetStatsUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly query: StatsQuery }): Promise<CampaignStatsRow[]> {
    return this.context.stats.summarize({
      companyId: params.companyId,
      from: params.query.from,
      to: params.query.to,
      ...(params.query.itemId ? { itemId: params.query.itemId } : {}),
      ...(params.query.sponsorId ? { sponsorId: params.query.sponsorId } : {}),
    })
  }
}
