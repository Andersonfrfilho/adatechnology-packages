/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CampaignInUseError,
  CampaignNotFoundError,
  checkCampaignRules,
  CODE_MODE,
  DuplicateCouponCodeError,
  generateCouponCode,
  InvalidCampaignError,
  type Campaign,
  type CampaignListItem,
  type CampaignReport,
  type CreateCampaignData,
  type ListCampaignsQuery,
  type Paginated,
  type UpdateCampaignData,
} from '@adatechnology/coupon-contracts'

import type { CampaignRow, NewCampaignRow } from '../schema/schema'
import { runHook } from '../shared/runHook'
import { paginate, toCampaign } from '../shared/toContract'
import type { CouponDependencies, CouponStores } from './couponModule.types'

export type CampaignReference = { readonly companyId: string; readonly id: string }

const EMPTY_STATS = { redemptionCount: 0, discountCents: 0, leadCount: 0 }
const GENERATED_FIXED_ATTEMPTS = 5

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  return value === null ? null : new Date(value)
}

function toRowValues(input: Partial<CreateCampaignData>): Partial<NewCampaignRow> {
  const values: Partial<NewCampaignRow> = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.terms !== undefined ? { terms: input.terms } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.codePrefix !== undefined ? { codePrefix: input.codePrefix || null } : {}),
    ...(input.usageLimitTotal !== undefined ? { usageLimitTotal: input.usageLimitTotal } : {}),
    ...(input.usageLimitPerCustomer !== undefined ? { usageLimitPerCustomer: input.usageLimitPerCustomer } : {}),
    ...(input.usageLimitPerCode !== undefined ? { usageLimitPerCode: input.usageLimitPerCode } : {}),
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.isAutomatic !== undefined ? { isAutomatic: input.isAutomatic } : {}),
    ...(input.leadCapture !== undefined ? { leadCapture: input.leadCapture } : {}),
  }
  const startsAt = toDate(input.startsAt)
  const endsAt = toDate(input.endsAt)
  if (startsAt !== undefined) values.startsAt = startsAt
  if (endsAt !== undefined) values.endsAt = endsAt
  if (input.discount) {
    values.discountKind = input.discount.kind
    values.discountValue = input.discount.value
    values.maxDiscountCents = input.discount.maxDiscountCents
    values.minSubtotalCents = input.discount.minSubtotalCents
  }
  return values
}

/** Código fixo vira também uma linha em `coupons`: a busca por código é uma só para os três modos. */
async function insertFixedCode(params: {
  readonly stores: CouponStores
  readonly row: CampaignRow
  readonly requested: string | null
  readonly dependencies: CouponDependencies
}): Promise<string> {
  const { stores, row } = params
  const attempts = params.requested ? 1 : GENERATED_FIXED_ATTEMPTS
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code =
      params.requested ?? generateCouponCode({ prefix: row.codePrefix, randomInt: params.dependencies.randomInt })
    const inserted = await stores.coupons.insertMany([{ companyId: row.companyId, campaignId: row.id, code }])
    if (inserted.length > 0) return code
  }
  throw new DuplicateCouponCodeError(params.requested ?? '')
}

export class CreateCampaignUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: { readonly companyId: string; readonly input: CreateCampaignData }): Promise<Campaign> {
    const { input } = params
    const row = await this.dependencies.persistence.transaction(async (stores) => {
      const created = await stores.campaigns.create({
        ...(toRowValues(input) as NewCampaignRow),
        companyId: params.companyId,
        codeMode: input.codeMode,
        fixedCode: null,
      })
      if (input.codeMode !== CODE_MODE.FIXED) return created
      const code = await insertFixedCode({
        stores,
        row: created,
        requested: input.fixedCode,
        dependencies: this.dependencies,
      })
      const updated = await stores.campaigns.update({
        companyId: params.companyId,
        id: created.id,
        values: { fixedCode: code },
      })
      return updated ?? created
    })
    const campaign = toCampaign(row)
    await notifyChanged(this.dependencies, campaign)
    return campaign
  }
}

async function notifyChanged(dependencies: CouponDependencies, campaign: Campaign): Promise<void> {
  const hook = dependencies.hooks?.onCampaignChanged
  if (!hook) return
  await runHook({
    name: 'onCampaignChanged',
    logger: dependencies.logger,
    meta: { campaignId: campaign.id },
    run: () => hook({ campaign }),
  })
}

export class UpdateCampaignUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: CampaignReference & { readonly input: UpdateCampaignData }): Promise<Campaign> {
    const row = await this.dependencies.persistence.transaction(async (stores) => {
      const current = await stores.campaigns.lockById(params)
      if (!current) throw new CampaignNotFoundError(params.id)
      const merged = { ...toCampaign(current), ...params.input }
      const issues = checkCampaignRules(merged)
      if (issues.length > 0) throw new InvalidCampaignError(issues)
      const values = toRowValues(params.input)
      const fixedCode = await this.replaceFixedCode({ stores, current, requested: params.input.fixedCode })
      return (
        (await stores.campaigns.update({
          ...params,
          values: { ...values, ...(fixedCode ? { fixedCode } : {}), updatedAt: this.dependencies.clock.now() },
        })) ?? current
      )
    })
    const campaign = toCampaign(row)
    await notifyChanged(this.dependencies, campaign)
    return campaign
  }

  private async replaceFixedCode(params: {
    readonly stores: CouponStores
    readonly current: CampaignRow
    readonly requested: string | null | undefined
  }): Promise<string | undefined> {
    const { stores, current, requested } = params
    if (current.codeMode !== CODE_MODE.FIXED || !requested || requested === current.fixedCode) return undefined
    const taken = await stores.coupons.findByCode({ companyId: current.companyId, code: requested })
    if (taken) throw new DuplicateCouponCodeError(requested)
    const fixed = await stores.coupons.findFixed({ companyId: current.companyId, campaignId: current.id })
    if (fixed) await stores.coupons.updateCode({ companyId: current.companyId, id: fixed.id, code: requested })
    else await stores.coupons.insertMany([{ companyId: current.companyId, campaignId: current.id, code: requested }])
    return requested
  }
}

export class GetCampaignUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: CampaignReference): Promise<Campaign> {
    const row = await this.dependencies.persistence.campaigns.findById(params)
    if (!row) throw new CampaignNotFoundError(params.id)
    return toCampaign(row)
  }
}

export class ListCampaignsUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: ListCampaignsQuery & { readonly companyId: string }): Promise<Paginated<CampaignListItem>> {
    const { campaigns } = this.dependencies.persistence
    const page = await campaigns.list({ ...params, now: this.dependencies.clock.now() })
    const stats = await campaigns.stats({ companyId: params.companyId, campaignIds: page.rows.map((row) => row.id) })
    const data = page.rows.map((row) => ({ ...toCampaign(row), stats: stats.get(row.id) ?? EMPTY_STATS }))
    return paginate({ data, total: page.total, page: params.page, pageSize: params.pageSize })
  }
}

/** Só apaga campanha sem uso nem contato; com histórico, o caminho é desativar. */
export class RemoveCampaignUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: CampaignReference): Promise<void> {
    await this.dependencies.persistence.transaction(async (stores) => {
      const row = await stores.campaigns.lockById(params)
      if (!row) throw new CampaignNotFoundError(params.id)
      if (await stores.campaigns.hasActivity(params)) throw new CampaignInUseError(params.id)
      await stores.campaigns.remove(params)
    })
  }
}

export class GetCampaignReportUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: CampaignReference): Promise<CampaignReport> {
    const { campaigns, coupons, leads, redemptions } = this.dependencies.persistence
    if (!(await campaigns.findById(params))) throw new CampaignNotFoundError(params.id)
    const scope = { companyId: params.companyId, campaignId: params.id }
    const [totals, leadCount, couponCounts] = await Promise.all([
      redemptions.totals(scope),
      leads.count(scope),
      coupons.count(scope),
    ])
    return {
      campaignId: params.id,
      redemptionCount: totals.redeemed,
      releasedCount: totals.released,
      discountCents: totals.discountCents,
      subtotalCents: totals.subtotalCents,
      leadCount,
      couponCount: couponCounts.total,
      usedCouponCount: couponCounts.used,
    }
  }
}
