/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Resgate e liberação, idempotentes pelo pedido (`orderRef`). A campanha fica travada durante a
 * transação, então dois pedidos simultâneos nunca passam juntos do limite.
 */

import {
  COUPON_REJECTION,
  CouponNotApplicableError,
  evaluateCampaign,
  OrderAlreadyRedeemedError,
  REDEMPTION_STATUS,
  type CartItem,
  type CouponStatus,
  type ListRedemptionsQuery,
  type OrderRef,
  type Paginated,
  type Redemption,
} from '@adatechnology/coupon-contracts'

import type { CampaignRow, RedemptionRow } from '../schema/schema'
import { isUniqueViolation } from '../shared/isUniqueViolation'
import { runHook } from '../shared/runHook'
import { paginate, toCampaign, toRedemption } from '../shared/toContract'
import type { CouponDependencies, CouponStores } from './couponModule.types'

export type RedeemCouponParams = {
  readonly companyId: string
  /** Com código, resgata o cupom. Sem, a campanha automática `campaignId`. */
  readonly code?: string | undefined
  readonly campaignId?: string | undefined
  readonly orderRef: OrderRef
  readonly items: readonly CartItem[]
  /** Identidade confiável, resolvida pelo backend do host. Obrigatória quando há limite por cliente. */
  readonly customerRef?: string | undefined
}

export type RedeemCouponResult = { readonly redemption: Redemption; readonly isNew: boolean }

type Target = { readonly campaign: CampaignRow; readonly code: string | null; readonly couponStatus?: CouponStatus }

const orderKey = (params: { companyId: string; orderRef: OrderRef }) => ({
  companyId: params.companyId,
  orderKind: params.orderRef.kind,
  orderId: params.orderRef.id,
})

/** Mesmo pedido, mesmo cupom (ou mesma automática): é repetição, devolve o resgate existente. */
function isSameRedemption(row: RedemptionRow, params: RedeemCouponParams): boolean {
  return params.code !== undefined
    ? row.couponCode === params.code
    : row.couponCode === null && row.campaignId === params.campaignId
}

function repeated(existing: RedemptionRow, params: RedeemCouponParams): RedeemCouponResult {
  if (!isSameRedemption(existing, params)) throw new OrderAlreadyRedeemedError(params.orderRef.kind)
  return { redemption: toRedemption(existing), isNew: false }
}

async function resolveTarget(stores: CouponStores, params: RedeemCouponParams): Promise<Target> {
  const notFound = () => new CouponNotApplicableError([COUPON_REJECTION.NOT_FOUND])
  if (params.code !== undefined) {
    const coupon = await stores.coupons.findByCode({ companyId: params.companyId, code: params.code })
    if (!coupon) throw notFound()
    const campaign = await stores.campaigns.lockById({ companyId: params.companyId, id: coupon.campaignId })
    if (!campaign) throw notFound()
    return { campaign, code: coupon.code, couponStatus: coupon.status as CouponStatus }
  }
  const campaign = await stores.campaigns.lockById({ companyId: params.companyId, id: params.campaignId ?? '' })
  if (!campaign?.isAutomatic) throw notFound()
  return { campaign, code: null }
}

export class RedeemCouponUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: RedeemCouponParams): Promise<RedeemCouponResult> {
    let result: RedeemCouponResult
    try {
      result = await this.dependencies.persistence.transaction((stores) => this.redeem(stores, params))
    } catch (error) {
      // Outro resgate do mesmo pedido entrou entre a leitura e o INSERT: o índice único decidiu.
      if (!isUniqueViolation(error)) throw error
      const existing = await this.dependencies.persistence.redemptions.findByOrder(orderKey(params))
      if (!existing || !isSameRedemption(existing, params)) throw new OrderAlreadyRedeemedError(params.orderRef.kind)
      return { redemption: toRedemption(existing), isNew: false }
    }
    const hook = this.dependencies.hooks?.onRedeemed
    if (result.isNew && hook) {
      const { redemption } = result
      await runHook({
        name: 'onRedeemed',
        logger: this.dependencies.logger,
        meta: { redemptionId: redemption.id },
        run: () => hook({ redemption }),
      })
    }
    return result
  }

  private async redeem(stores: CouponStores, params: RedeemCouponParams): Promise<RedeemCouponResult> {
    const before = await stores.redemptions.findByOrder(orderKey(params))
    if (before?.status === REDEMPTION_STATUS.REDEEMED) return repeated(before, params)

    const target = await resolveTarget(stores, params)
    // Relê com a campanha travada: a repetição do mesmo pedido que esperou na trava encontra o resgate
    // já confirmado e o devolve, em vez de contar o próprio uso e recusar por limite.
    const existing = await stores.redemptions.findByOrder(orderKey(params))
    if (existing?.status === REDEMPTION_STATUS.REDEEMED) return repeated(existing, params)
    const { campaign } = target
    const customerRef = params.customerRef ?? null
    const usage = await stores.redemptions.usage({
      companyId: params.companyId,
      campaignId: campaign.id,
      code: target.code,
      customerRef,
    })
    const evaluation = evaluateCampaign({
      campaign: toCampaign(campaign),
      items: params.items,
      at: this.dependencies.clock.now(),
      usage,
      ...(target.couponStatus ? { couponStatus: target.couponStatus } : {}),
      ...(params.customerRef ? { customerRef: params.customerRef } : {}),
      requireCustomer: true,
    })
    if (!evaluation.valid) throw new CouponNotApplicableError(evaluation.reasons)

    const values = {
      campaignId: campaign.id,
      couponCode: target.code,
      customerRef,
      subtotalCents: evaluation.subtotalCents,
      discountCents: evaluation.discountCents,
      status: REDEMPTION_STATUS.REDEEMED,
      redeemedAt: this.dependencies.clock.now(),
      releasedAt: null,
    }
    const row = existing
      ? await stores.redemptions.update({ companyId: params.companyId, id: existing.id, values })
      : await stores.redemptions.insert({ ...values, ...orderKey(params) })
    if (!row) throw new CouponNotApplicableError([COUPON_REJECTION.NOT_FOUND])
    if (target.code) await stores.coupons.adjustUsedCount({ companyId: params.companyId, code: target.code, delta: 1 })
    return { redemption: toRedemption(row), isNew: true }
  }
}

/**
 * Devolve o uso (pedido cancelado, pagamento recusado). Pedido sem resgate ou já liberado é
 * resposta válida, não erro: o host pode chamar de novo sem medo.
 */
export class ReleaseRedemptionUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(params: { readonly companyId: string; readonly orderRef: OrderRef }): Promise<Redemption | undefined> {
    const released = await this.dependencies.persistence.transaction(async (stores) => {
      const found = await stores.redemptions.findByOrder(orderKey(params))
      if (!found || found.status !== REDEMPTION_STATUS.REDEEMED) return { row: found, changed: false }
      // Trava a campanha e relê: duas liberações simultâneas não descontam o uso duas vezes.
      await stores.campaigns.lockById({ companyId: params.companyId, id: found.campaignId })
      const current = await stores.redemptions.findByOrder(orderKey(params))
      if (!current || current.status !== REDEMPTION_STATUS.REDEEMED) return { row: current, changed: false }
      const row = await stores.redemptions.update({
        companyId: params.companyId,
        id: current.id,
        values: { status: REDEMPTION_STATUS.RELEASED, releasedAt: this.dependencies.clock.now() },
      })
      if (current.couponCode)
        await stores.coupons.adjustUsedCount({ companyId: params.companyId, code: current.couponCode, delta: -1 })
      return { row, changed: true }
    })
    if (!released.row) return undefined
    const redemption = toRedemption(released.row)
    const hook = this.dependencies.hooks?.onReleased
    if (released.changed && hook)
      await runHook({
        name: 'onReleased',
        logger: this.dependencies.logger,
        meta: { redemptionId: redemption.id },
        run: () => hook({ redemption }),
      })
    return redemption
  }
}

export class ListRedemptionsUseCase {
  constructor(private readonly dependencies: CouponDependencies) {}

  async execute(
    params: ListRedemptionsQuery & { readonly companyId: string; readonly campaignId: string },
  ): Promise<Paginated<Redemption>> {
    const page = await this.dependencies.persistence.redemptions.list(params)
    return paginate({
      data: page.rows.map(toRedemption),
      total: page.total,
      page: params.page,
      pageSize: params.pageSize,
    })
  }
}
