/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  ITEM_STATUS,
  InvalidAgeRangeError,
  ItemNotFoundError,
  RECOMMENDATION_SOURCE,
  SponsorNotAllowedError,
  SponsorNotFoundError,
  SponsorRequiredError,
  type CreateItemInput,
  type ListItemsQuery,
  type PaginatedItems,
  type RecommendationItem,
  type RecommendationItemWithCampaigns,
  type RecommendationSource,
  type UpdateItemInput,
} from '@adatechnology/recommendation-contracts'

import type { NewItemRow } from '../schema/schema'
import { validateAttributes } from '../shared/attributes'
import { toCampaign, toItem } from '../shared/mappers'
import { kindOf, scopeArg, type UseCaseContext } from './context'

type Scoped = { readonly companyId?: string }

/**
 * Patrocinado TEM anunciante e curadoria NÃO tem. A segunda metade importa tanto quanto a
 * primeira: curadoria com anunciante é anúncio sem o rótulo de patrocinado.
 */
async function assertSponsor(
  context: UseCaseContext,
  params: { readonly source: RecommendationSource; readonly sponsorId: string | null; readonly companyId?: string },
): Promise<void> {
  if (params.source === RECOMMENDATION_SOURCE.SPONSORED) {
    if (!params.sponsorId) throw new SponsorRequiredError()
    if (context.sponsors) {
      const found = await context.sponsors.exists({ sponsorId: params.sponsorId, ...scopeArg(params.companyId) })
      if (!found) throw new SponsorNotFoundError()
    }
    return
  }
  if (params.sponsorId) throw new SponsorNotAllowedError()
}

function assertAges(minAge: number | null | undefined, maxAge: number | null | undefined): void {
  if (minAge != null && maxAge != null && minAge > maxAge) throw new InvalidAgeRangeError()
}

export class CreateItemUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly input: CreateItemInput }): Promise<RecommendationItem> {
    const { input } = params
    const kind = kindOf(this.context.config, input.kind)
    const sponsorId = input.sponsorId ?? null
    await assertSponsor(this.context, { source: input.source, sponsorId, ...scopeArg(params.companyId) })
    assertAges(input.minAge, input.maxAge)

    const row = await this.context.items.insert({
      companyId: params.companyId ?? null,
      kind: kind.name,
      source: input.source,
      status: input.status ?? ITEM_STATUS.DRAFT,
      title: input.title,
      summary: input.summary ?? null,
      imageUrl: input.imageUrl ?? null,
      linkUrl: input.linkUrl ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      minAge: input.minAge ?? null,
      maxAge: input.maxAge ?? null,
      tags: [...new Set(input.tags ?? [])],
      attributes: validateAttributes({ kind, attributes: input.attributes ?? {} }),
      sponsorId,
    })

    this.context.logger?.info('recommendation.item.created', { itemId: row.id, kind: row.kind, source: row.source })
    return toItem(row)
  }
}

export class UpdateItemUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(
    params: Scoped & { readonly id: string; readonly input: UpdateItemInput },
  ): Promise<RecommendationItem> {
    const { input } = params
    const current = await this.context.items.findById({ companyId: params.companyId, id: params.id })
    if (!current) throw new ItemNotFoundError()

    const existing = toItem(current)
    const kind = kindOf(this.context.config, existing.kind)

    const sponsorId = input.sponsorId === undefined ? existing.sponsorId : input.sponsorId
    if (input.sponsorId !== undefined) {
      await assertSponsor(this.context, { source: existing.source, sponsorId, ...scopeArg(params.companyId) })
    }

    assertAges(
      input.minAge === undefined ? existing.minAge : input.minAge,
      input.maxAge === undefined ? existing.maxAge : input.maxAge,
    )

    const values: Partial<NewItemRow> = {}
    if (input.title !== undefined) values.title = input.title
    if (input.summary !== undefined) values.summary = input.summary
    if (input.imageUrl !== undefined) values.imageUrl = input.imageUrl
    if (input.linkUrl !== undefined) values.linkUrl = input.linkUrl
    if (input.city !== undefined) values.city = input.city
    if (input.state !== undefined) values.state = input.state
    if (input.minAge !== undefined) values.minAge = input.minAge
    if (input.maxAge !== undefined) values.maxAge = input.maxAge
    if (input.tags !== undefined) values.tags = [...new Set(input.tags)]
    if (input.status !== undefined) values.status = input.status
    if (input.sponsorId !== undefined) values.sponsorId = sponsorId
    if (input.attributes !== undefined) {
      // Mescla e confere o RESULTADO: obrigatório continua obrigatório, e `null` apaga o campo.
      values.attributes = validateAttributes({ kind, attributes: { ...existing.attributes, ...input.attributes } })
    }

    const row = await this.context.items.update({ companyId: params.companyId, id: params.id, values })
    if (!row) throw new ItemNotFoundError()
    return toItem(row)
  }
}

export class GetItemUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly id: string }): Promise<RecommendationItemWithCampaigns> {
    const row = await this.context.items.findById({ companyId: params.companyId, id: params.id })
    if (!row) throw new ItemNotFoundError()
    const campaigns = await this.context.campaigns.listByItem({ companyId: params.companyId, itemId: row.id })
    return { ...toItem(row), campaigns: campaigns.map(toCampaign) }
  }
}

export class ListItemsUseCase {
  constructor(private readonly context: UseCaseContext) {}

  async execute(params: Scoped & { readonly query: ListItemsQuery }): Promise<PaginatedItems> {
    const { rows, total } = await this.context.items.list({ companyId: params.companyId, query: params.query })
    return {
      data: rows.map(toItem),
      pagination: { total, page: params.query.page, perPage: params.query.perPage },
    }
  }
}
