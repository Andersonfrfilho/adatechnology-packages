/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CAMPAIGN_STATUS,
  CampaignNotFoundError,
  CampaignOnCuratedError,
  InvalidPeriodError,
  ItemNotFoundError,
  PlanNotEntitledError,
  RECOMMENDATION_SOURCE,
  type Campaign,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from '@adatechnology/recommendation-contracts'

import type { NewCampaignRow } from '../schema/schema'
import { toCampaign, toItem } from '../shared/mappers'
import { assertPlacements, planOf, scopeArg, type UseCaseContext } from './context'

type Scoped = { readonly companyId?: string }

async function assertEntitled(
  context: UseCaseContext,
  params: { readonly sponsorId: string | null; readonly plan: string; readonly companyId?: string },
): Promise<void> {
  if (!context.entitlement || !params.sponsorId) return
  const entitled = await context.entitlement.isEntitled({
    sponsorId: params.sponsorId,
    plan: params.plan,
    at: context.clock.now(),
    ...scopeArg(params.companyId),
  })
  if (!entitled) throw new PlanNotEntitledError(params.plan)
}

export class CreateCampaignUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly itemId: string; readonly input: CreateCampaignInput }): Promise<Campaign> {
    const { input } = params
    const itemRow = await this.context.items.findById({ companyId: params.companyId, id: params.itemId })
    if (!itemRow) throw new ItemNotFoundError()
    const item = toItem(itemRow)
    if (item.source !== RECOMMENDATION_SOURCE.SPONSORED) throw new CampaignOnCuratedError()

    planOf(this.context.config, input.plan)
    assertPlacements(this.context.config, input.placements)
    if (input.endsAt && input.endsAt <= input.startsAt) throw new InvalidPeriodError()

    const status = input.status ?? CAMPAIGN_STATUS.ACTIVE
    if (status === CAMPAIGN_STATUS.ACTIVE) {
      await assertEntitled(this.context, { sponsorId: item.sponsorId, plan: input.plan, ...scopeArg(params.companyId) })
    }

    const row = await this.context.campaigns.insert({
      companyId: params.companyId ?? null,
      itemId: item.id,
      plan: input.plan,
      status,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      placements: [...new Set(input.placements)],
      externalReference: input.externalReference ?? null,
    })

    this.context.logger?.info('recommendation.campaign.created', {
      campaignId: row.id,
      itemId: item.id,
      plan: row.plan,
    })
    return toCampaign(row)
  }
}

export class UpdateCampaignUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly id: string; readonly input: UpdateCampaignInput }): Promise<Campaign> {
    const { input } = params
    const currentRow = await this.context.campaigns.findById({ companyId: params.companyId, id: params.id })
    if (!currentRow) throw new CampaignNotFoundError()
    const current = toCampaign(currentRow)

    const plan = input.plan ?? current.plan
    planOf(this.context.config, plan)
    if (input.placements) assertPlacements(this.context.config, input.placements)

    const startsAt = input.startsAt ?? current.startsAt
    const endsAt = input.endsAt === undefined ? current.endsAt : input.endsAt
    if (endsAt && endsAt <= startsAt) throw new InvalidPeriodError()

    const status = input.status ?? current.status
    // Reativar ou trocar de plano é contratar de novo: pergunta à cobrança outra vez.
    const changesWhatIsSold = status === CAMPAIGN_STATUS.ACTIVE && (current.status !== status || plan !== current.plan)
    if (changesWhatIsSold) {
      const itemRow = await this.context.items.findById({ companyId: params.companyId, id: current.itemId })
      if (!itemRow) throw new ItemNotFoundError()
      await assertEntitled(this.context, { sponsorId: itemRow.sponsorId, plan, ...scopeArg(params.companyId) })
    }

    const values: Partial<NewCampaignRow> = { plan, status, startsAt, endsAt }
    if (input.priority !== undefined) values.priority = input.priority
    if (input.placements !== undefined) values.placements = [...new Set(input.placements)]
    if (input.externalReference !== undefined) values.externalReference = input.externalReference

    const row = await this.context.campaigns.update({ companyId: params.companyId, id: params.id, values })
    if (!row) throw new CampaignNotFoundError()
    return toCampaign(row)
  }
}
