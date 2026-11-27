/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Resgate e liberação idempotentes, limites persistidos, automática e concorrência.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createCampaignSchema, type CartItem } from '@adatechnology/coupon-contracts'

import { buildTestModule } from '../testing/buildTestModule'

const COMPANY = randomUUID()
const CART: CartItem[] = [{ productId: 'p1', priceCents: 10_000, quantity: 1 }]
const order = (id: string) => ({ kind: 'order', id })

async function setup(input: Record<string, unknown> = {}, hooks = {}) {
  const built = buildTestModule({ hooks })
  const campaign = await built.module.useCases.createCampaign.execute({
    companyId: COMPANY,
    input: createCampaignSchema.parse({
      name: 'Promo',
      isActive: true,
      fixedCode: 'PROMO10',
      discount: { kind: 'percent', value: 10 },
      ...input,
    }),
  })
  const redeem = (orderId: string, extra: Record<string, unknown> = {}) =>
    built.module.useCases.redeemCoupon.execute({
      companyId: COMPANY,
      code: 'PROMO10',
      orderRef: order(orderId),
      items: CART,
      ...extra,
    })
  const release = (orderId: string) =>
    built.module.useCases.releaseRedemption.execute({ companyId: COMPANY, orderRef: order(orderId) })
  return { ...built, campaign, redeem, release }
}

describe('resgate', () => {
  it('idempotente pelo pedido: repetir devolve o mesmo, sem contar de novo nem disparar o gancho', async () => {
    const redeemed: string[] = []
    const { redeem, persistence } = await setup(
      {},
      { onRedeemed: ({ redemption }: { redemption: { id: string } }) => void redeemed.push(redemption.id) },
    )
    const first = await redeem('A')
    const second = await redeem('A')
    expect(first).toMatchObject({
      isNew: true,
      redemption: { discountCents: 1_000, subtotalCents: 10_000, status: 'redeemed' },
    })
    expect(second).toEqual({ redemption: first.redemption, isNew: false })
    expect(persistence.state.redemptions).toHaveLength(1)
    expect(persistence.state.coupons[0]?.usedCount).toBe(1)
    expect(redeemed).toEqual([first.redemption.id])
  })

  it('outro cupom no mesmo pedido é 409', async () => {
    const { redeem, module } = await setup()
    await module.useCases.createCampaign.execute({
      companyId: COMPANY,
      input: createCampaignSchema.parse({
        name: 'Outra',
        isActive: true,
        fixedCode: 'OUTRA',
        discount: { kind: 'fixed', value: 500 },
      }),
    })
    await redeem('A')
    await expect(redeem('A', { code: 'OUTRA' })).rejects.toMatchObject({
      code: 'COUPON_ORDER_ALREADY_REDEEMED',
      statusCode: 409,
    })
  })

  it('recusa com todos os motivos (422) e nada é gravado', async () => {
    const { module, persistence } = await setup({
      endsAt: '2026-11-01T00:00:00Z',
      discount: { kind: 'percent', value: 10, minSubtotalCents: 50_000 },
    })
    await expect(
      module.useCases.redeemCoupon.execute({ companyId: COMPANY, code: 'PROMO10', orderRef: order('A'), items: CART }),
    ).rejects.toMatchObject({ statusCode: 422, details: { reasons: ['expired', 'min_subtotal_not_met'] } })
    expect(persistence.state.redemptions).toHaveLength(0)
  })

  it('código inexistente: 422 not_found', async () => {
    const { redeem } = await setup()
    await expect(redeem('A', { code: 'NADA' })).rejects.toMatchObject({ details: { reasons: ['not_found'] } })
  })

  it('limite total conta só os resgates ativos', async () => {
    const { redeem, release } = await setup({ usageLimitTotal: 1 })
    await redeem('A')
    await expect(redeem('B')).rejects.toMatchObject({ details: { reasons: ['total_limit_reached'] } })
    await release('A')
    expect((await redeem('B')).isNew).toBe(true)
  })

  it('limite por cliente exige cliente e conta por cliente', async () => {
    const { redeem } = await setup({ usageLimitPerCustomer: 1 })
    await expect(redeem('A')).rejects.toMatchObject({ details: { reasons: ['customer_required'] } })
    await redeem('A', { customerRef: 'c-1' })
    await expect(redeem('B', { customerRef: 'c-1' })).rejects.toMatchObject({
      details: { reasons: ['customer_limit_reached'] },
    })
    expect((await redeem('C', { customerRef: 'c-2' })).isNew).toBe(true)
  })

  it('código desativado não resgata', async () => {
    const { redeem, module, persistence, campaign } = await setup()
    const coupon = persistence.state.coupons[0]
    await expect(
      module.useCases.setCouponStatus.execute({
        companyId: COMPANY,
        campaignId: randomUUID(),
        id: coupon?.id ?? '',
        status: 'disabled',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
    await module.useCases.setCouponStatus.execute({
      companyId: COMPANY,
      campaignId: campaign.id,
      id: coupon?.id ?? '',
      status: 'disabled',
    })
    await expect(redeem('A')).rejects.toMatchObject({ details: { reasons: ['coupon_disabled'] } })
  })

  it('repetição do mesmo pedido no limite devolve o resgate existente, não recusa por limite', async () => {
    const { redeem } = await setup({ usageLimitTotal: 1 })
    const results = await Promise.all(Array.from({ length: 5 }, () => redeem('A')))
    expect(results.filter((result) => result.isNew)).toHaveLength(1)
    expect(new Set(results.map((result) => result.redemption.id)).size).toBe(1)
  })

  it('desconto que daria zero não vale (zero_discount)', async () => {
    const { module } = await setup({ discount: { kind: 'percent', value: 1 } })
    const result = await module.useCases.validateCoupon.execute({
      companyId: COMPANY,
      code: 'PROMO10',
      items: [{ productId: 'p', priceCents: 10, quantity: 1 }],
    })
    expect(result.reasons).toEqual(['zero_discount'])
  })

  it('concorrência: dez pedidos ao mesmo tempo nunca passam do limite', async () => {
    const { redeem, persistence } = await setup({ usageLimitTotal: 3 })
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => redeem(`order-${index}`)))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    expect(persistence.state.redemptions).toHaveLength(3)
    expect(persistence.state.coupons[0]?.usedCount).toBe(3)
  })

  it('automática: resgata por campanha, sem código', async () => {
    const built = buildTestModule()
    const auto = await built.module.useCases.createCampaign.execute({
      companyId: COMPANY,
      input: createCampaignSchema.parse({
        name: 'Auto',
        isActive: true,
        isAutomatic: true,
        discount: { kind: 'fixed', value: 700 },
      }),
    })
    await built.module.useCases.createCampaign.execute({
      companyId: COMPANY,
      input: createCampaignSchema.parse({
        name: 'Auto menor',
        isActive: true,
        isAutomatic: true,
        discount: { kind: 'fixed', value: 300 },
      }),
    })
    const best = await built.module.useCases.findAutomatic.execute({ companyId: COMPANY, items: CART })
    expect(best?.campaign.id).toBe(auto.id)
    expect(best?.validation.discountCents).toBe(700)
    const { redemption } = await built.module.useCases.redeemCoupon.execute({
      companyId: COMPANY,
      campaignId: auto.id,
      orderRef: order('A'),
      items: CART,
    })
    expect(redemption).toMatchObject({ couponCode: null, discountCents: 700 })
    expect(
      (
        await built.module.useCases.redeemCoupon.execute({
          companyId: COMPANY,
          campaignId: auto.id,
          orderRef: order('A'),
          items: CART,
        })
      ).isNew,
    ).toBe(false)
  })
})

describe('liberação', () => {
  it('idempotente: segunda chamada não desconta de novo; pedido sem resgate devolve undefined', async () => {
    const released: string[] = []
    const { redeem, release, persistence } = await setup(
      {},
      { onReleased: ({ redemption }: { redemption: { id: string } }) => void released.push(redemption.id) },
    )
    await redeem('A')
    const first = await release('A')
    const second = await release('A')
    expect(first?.status).toBe('released')
    expect(second?.status).toBe('released')
    expect(persistence.state.coupons[0]?.usedCount).toBe(0)
    expect(released).toHaveLength(1)
    expect(await release('nunca')).toBeUndefined()
  })

  it('resgatar de novo o pedido liberado reaproveita a linha', async () => {
    const { redeem, release, persistence } = await setup()
    await redeem('A')
    await release('A')
    const again = await redeem('A')
    expect(again.isNew).toBe(true)
    expect(persistence.state.redemptions).toHaveLength(1)
    expect(persistence.state.redemptions[0]?.status).toBe('redeemed')
  })

  it('relatório soma só o ativo', async () => {
    const { redeem, release, module, campaign } = await setup()
    await redeem('A')
    await redeem('B')
    await release('B')
    expect(await module.useCases.getCampaignReport.execute({ companyId: COMPANY, id: campaign.id })).toMatchObject({
      redemptionCount: 1,
      releasedCount: 1,
      discountCents: 1_000,
      subtotalCents: 10_000,
      couponCount: 1,
      usedCouponCount: 1,
    })
  })
})

describe('prévia', () => {
  it('validate não grava nada e mostra a campanha', async () => {
    const { module, persistence } = await setup()
    const result = await module.useCases.validateCoupon.execute({ companyId: COMPANY, code: 'PROMO10', items: CART })
    expect(result).toMatchObject({ valid: true, discountCents: 1_000, code: 'PROMO10', campaign: { title: '' } })
    expect(persistence.state.redemptions).toHaveLength(0)
    expect(
      (await module.useCases.validateCoupon.execute({ companyId: randomUUID(), code: 'PROMO10', items: CART })).reasons,
    ).toEqual(['not_found'])
  })
})
