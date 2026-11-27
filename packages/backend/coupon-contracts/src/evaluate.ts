/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Avaliação pura de um cupom: sem I/O, sem relógio, sem banco. O módulo chama com os usos lidos
 * dentro da transação do resgate; o site e os testes chamam com os mesmos números. A mesma função
 * decide nos dois lados, então a tela nunca promete um desconto que o servidor recusa.
 */

import {
  COUPON_REJECTION,
  COUPON_STATUS,
  DISCOUNT_KIND,
  SCOPE_KIND,
  type Campaign,
  type CampaignDiscount,
  type CampaignScope,
  type CartItem,
  type CouponRejection,
  type CouponStatus,
} from './coupon.types'

export type CampaignRules = Pick<
  Campaign,
  | 'isActive'
  | 'startsAt'
  | 'endsAt'
  | 'discount'
  | 'scope'
  | 'usageLimitTotal'
  | 'usageLimitPerCustomer'
  | 'usageLimitPerCode'
>

/** Usos já confirmados (resgates ativos). `customerUsed` só existe quando há cliente identificado. */
export type UsageSnapshot = {
  readonly totalUsed: number
  readonly codeUsed: number
  readonly customerUsed?: number
}

export type EvaluateCampaignParams = {
  readonly campaign: CampaignRules
  readonly items: readonly CartItem[]
  readonly at: Date
  readonly usage: UsageSnapshot
  /** Ausente em campanha automática (não há código). */
  readonly couponStatus?: CouponStatus
  readonly customerRef?: string
  /**
   * `true` no resgate: campanha com limite por cliente exige saber quem é. `false` na prévia do
   * site, que não tem identidade confiável — lá o limite por cliente só é conferido no resgate.
   */
  readonly requireCustomer?: boolean
}

export type CampaignEvaluation = {
  readonly valid: boolean
  readonly discountCents: number
  readonly subtotalCents: number
  readonly eligibleSubtotalCents: number
  readonly reasons: readonly CouponRejection[]
}

export function lineTotalCents(item: CartItem): number {
  return Math.max(0, Math.round(item.priceCents)) * Math.max(0, Math.floor(item.quantity))
}

export function isItemInScope(item: CartItem, scope: CampaignScope): boolean {
  if (scope.kind === SCOPE_KIND.ALL) return true
  if (scope.kind === SCOPE_KIND.PRODUCTS) return scope.productIds.includes(item.productId)
  if (scope.kind === SCOPE_KIND.CATEGORIES) return (item.categoryIds ?? []).some((id) => scope.categoryIds.includes(id))
  return (item.tags ?? []).some((tag) => scope.tags.includes(tag))
}

/**
 * Percentual arredonda meio centavo para cima; o teto (`maxDiscountCents`) vem depois; e o
 * desconto nunca passa do subtotal elegível (pedido não fica negativo).
 */
export function computeDiscountCents(params: {
  readonly discount: CampaignDiscount
  readonly eligibleSubtotalCents: number
}): number {
  const { discount, eligibleSubtotalCents } = params
  const raw =
    discount.kind === DISCOUNT_KIND.PERCENT
      ? Math.round((eligibleSubtotalCents * discount.value) / 100)
      : discount.value
  const capped = discount.maxDiscountCents === null ? raw : Math.min(raw, discount.maxDiscountCents)
  return Math.max(0, Math.min(capped, eligibleSubtotalCents))
}

/** Início inclusivo, fim exclusivo. */
export function windowRejection(
  campaign: Pick<Campaign, 'startsAt' | 'endsAt'>,
  at: Date,
): CouponRejection | undefined {
  if (campaign.startsAt !== null && at.getTime() < Date.parse(campaign.startsAt)) return COUPON_REJECTION.NOT_STARTED
  if (campaign.endsAt !== null && at.getTime() >= Date.parse(campaign.endsAt)) return COUPON_REJECTION.EXPIRED
  return undefined
}

export function isCampaignOpen(campaign: Pick<Campaign, 'isActive' | 'startsAt' | 'endsAt'>, at: Date): boolean {
  return campaign.isActive && windowRejection(campaign, at) === undefined
}

function limitRejections(params: EvaluateCampaignParams): CouponRejection[] {
  const { campaign, usage } = params
  const reasons: CouponRejection[] = []
  if (campaign.usageLimitTotal !== null && usage.totalUsed >= campaign.usageLimitTotal)
    reasons.push(COUPON_REJECTION.TOTAL_LIMIT_REACHED)
  if (
    params.couponStatus !== undefined &&
    campaign.usageLimitPerCode !== null &&
    usage.codeUsed >= campaign.usageLimitPerCode
  )
    reasons.push(COUPON_REJECTION.CODE_LIMIT_REACHED)
  if (campaign.usageLimitPerCustomer === null) return reasons
  if (params.customerRef === undefined) {
    if (params.requireCustomer) reasons.push(COUPON_REJECTION.CUSTOMER_REQUIRED)
    return reasons
  }
  if ((usage.customerUsed ?? 0) >= campaign.usageLimitPerCustomer) reasons.push(COUPON_REJECTION.CUSTOMER_LIMIT_REACHED)
  return reasons
}

function cartRejections(params: {
  readonly campaign: CampaignRules
  readonly items: readonly CartItem[]
  readonly eligibleSubtotalCents: number
}): CouponRejection[] {
  if (params.items.length === 0) return [COUPON_REJECTION.EMPTY_CART]
  if (params.eligibleSubtotalCents === 0) return [COUPON_REJECTION.NO_ELIGIBLE_ITEMS]
  const minimum = params.campaign.discount.minSubtotalCents
  return minimum !== null && params.eligibleSubtotalCents < minimum ? [COUPON_REJECTION.MIN_SUBTOTAL_NOT_MET] : []
}

/** Todos os motivos de uma vez, na ordem em que a pessoa resolveria (campanha, período, limites, carrinho). */
export function evaluateCampaign(params: EvaluateCampaignParams): CampaignEvaluation {
  const { campaign, items } = params
  const subtotalCents = items.reduce((sum, item) => sum + lineTotalCents(item), 0)
  const eligibleSubtotalCents = items
    .filter((item) => isItemInScope(item, campaign.scope))
    .reduce((sum, item) => sum + lineTotalCents(item), 0)

  const reasons: CouponRejection[] = []
  if (!campaign.isActive) reasons.push(COUPON_REJECTION.CAMPAIGN_INACTIVE)
  if (params.couponStatus === COUPON_STATUS.DISABLED) reasons.push(COUPON_REJECTION.COUPON_DISABLED)
  const window = windowRejection(campaign, params.at)
  if (window) reasons.push(window)
  reasons.push(...limitRejections(params), ...cartRejections({ campaign, items, eligibleSubtotalCents }))

  const discountCents =
    reasons.length === 0 ? computeDiscountCents({ discount: campaign.discount, eligibleSubtotalCents }) : 0
  return { valid: reasons.length === 0, discountCents, subtotalCents, eligibleSubtotalCents, reasons }
}
