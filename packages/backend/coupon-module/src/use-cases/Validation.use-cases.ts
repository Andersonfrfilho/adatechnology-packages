/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Prévia do desconto: lê os usos sem travar nada. A palavra final é do resgate, que repete a mesma
 * avaliação dentro da transação com a campanha travada.
 */

import {
  CampaignUnavailableError,
  COUPON_REJECTION,
  evaluateCampaign,
  isCampaignOpen,
  type CartItem,
  type CouponStatus,
  type CouponValidation,
  type PublicCampaign,
} from '@adatechnology/coupon-contracts'

import type { CampaignRow } from '../schema/schema'
import { toCampaign, toPublicCampaign } from '../shared/toContract'
import type { CouponDependencies } from './couponModule.types'

export type ValidateCouponParams = {
  readonly companyId: string
  readonly code: string
  readonly items: readonly CartItem[]
  readonly customerRef?: string | undefined
  readonly at?: Date | undefined
}

export type AutomaticDiscount = { readonly campaign: PublicCampaign; readonly validation: CouponValidation }

function notFound(items: readonly CartItem[]): CouponValidation {
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  return {
    valid: false,
    discountCents: 0,
    subtotalCents,
    eligibleSubtotalCents: 0,
    reasons: [COUPON_REJECTION.NOT_FOUND],
  }
}

export async function evaluateRow(params: {
  readonly dependencies: CouponDependencies
  readonly campaign: CampaignRow
  readonly code: string | null
  readonly couponStatus?: CouponStatus
  readonly items: readonly CartItem[]
  readonly customerRef?: string | undefined
  readonly at: Date
}): Promise<CouponValidation> {
  const { campaign } = params
  const usage = await params.dependencies.persistence.redemptions.usage({
    companyId: campaign.companyId,
    campaignId: campaign.id,
    code: params.code,
    customerRef: params.customerRef ?? null,
  })
  const evaluation = evaluateCampaign({
    campaign: toCampaign(campaign),
    items: params.items,
    at: params.at,
    usage,
    ...(params.couponStatus ? { couponStatus: params.couponStatus } : {}),
    ...(params.customerRef ? { customerRef: params.customerRef } : {}),
    requireCustomer: false,
  })
  return { ...evaluation, campaign: toPublicCampaign(campaign), code: params.code }
}

export class ValidateCouponUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: ValidateCouponParams): Promise<CouponValidation> {
    const { persistence, clock } = this.dependencies
    const coupon = await persistence.coupons.findByCode({ companyId: params.companyId, code: params.code })
    if (!coupon) return notFound(params.items)
    const campaign = await persistence.campaigns.findById({ companyId: params.companyId, id: coupon.campaignId })
    if (!campaign) return notFound(params.items)
    return evaluateRow({
      dependencies: this.dependencies,
      campaign,
      code: coupon.code,
      couponStatus: coupon.status as CouponStatus,
      items: params.items,
      customerRef: params.customerRef,
      at: params.at ?? clock.now(),
    })
  }
}

/** A campanha automática que dá o maior desconto ao carrinho; `undefined` quando nenhuma se aplica. */
export class FindAutomaticUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: Omit<ValidateCouponParams, 'code'>): Promise<AutomaticDiscount | undefined> {
    const at = params.at ?? this.dependencies.clock.now()
    const open = await this.dependencies.persistence.campaigns.listOpenAutomatic({
      companyId: params.companyId,
      now: at,
    })
    const validations = await Promise.all(
      open.map((campaign) =>
        evaluateRow({
          dependencies: this.dependencies,
          campaign,
          code: null,
          items: params.items,
          customerRef: params.customerRef,
          at,
        }),
      ),
    )
    const best = validations
      .filter((validation) => validation.valid)
      .sort((left, right) => right.discountCents - left.discountCents)[0]
    return best?.campaign ? { campaign: best.campaign, validation: best } : undefined
  }
}

export class ListPublicCampaignsUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: { readonly companyId: string }): Promise<readonly PublicCampaign[]> {
    const rows = await this.dependencies.persistence.campaigns.listOpen({
      companyId: params.companyId,
      now: this.dependencies.clock.now(),
    })
    return rows.map(toPublicCampaign)
  }
}

/** Desligada, fora do período e inexistente dão a mesma resposta: o site anônimo não sonda o painel. */
export class GetPublicCampaignUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: { readonly companyId: string; readonly id: string }): Promise<PublicCampaign> {
    const row = await this.dependencies.persistence.campaigns.findById(params)
    if (!row || !isCampaignOpen(toCampaign(row), this.dependencies.clock.now())) throw new CampaignUnavailableError()
    return toPublicCampaign(row)
  }
}
