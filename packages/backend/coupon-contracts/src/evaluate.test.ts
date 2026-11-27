/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Matriz de validação: datas, limites, escopo, subtotal mínimo, teto, fixo × percentual.
 */

import { describe, expect, it } from 'bun:test'

import { campaignState } from './campaignState'
import { COUPON_REJECTION, type CartItem } from './coupon.types'
import { computeDiscountCents, evaluateCampaign, type CampaignRules, type UsageSnapshot } from './evaluate'

const AT = new Date('2026-11-20T12:00:00.000Z')
const NO_USE: UsageSnapshot = { totalUsed: 0, codeUsed: 0, customerUsed: 0 }

const BASE: CampaignRules = {
  isActive: true,
  startsAt: null,
  endsAt: null,
  discount: { kind: 'percent', value: 10, maxDiscountCents: null, minSubtotalCents: null },
  scope: { kind: 'all' },
  usageLimitTotal: null,
  usageLimitPerCustomer: null,
  usageLimitPerCode: null,
}

const CART: CartItem[] = [
  { productId: 'p1', categoryIds: ['c1'], tags: ['verao'], priceCents: 10_000, quantity: 2 },
  { productId: 'p2', categoryIds: ['c2'], tags: [], priceCents: 5_000, quantity: 1 },
]

function evaluate(overrides: Partial<CampaignRules> = {}, extra: Partial<Parameters<typeof evaluateCampaign>[0]> = {}) {
  return evaluateCampaign({
    campaign: { ...BASE, ...overrides },
    items: CART,
    at: AT,
    usage: NO_USE,
    couponStatus: 'active',
    ...extra,
  })
}

describe('desconto', () => {
  it('percentual sobre o subtotal elegível', () => {
    const result = evaluate()
    expect(result).toMatchObject({
      valid: true,
      discountCents: 2_500,
      subtotalCents: 25_000,
      eligibleSubtotalCents: 25_000,
    })
  })

  it('fixo em centavos', () => {
    expect(
      evaluate({ discount: { kind: 'fixed', value: 3_000, maxDiscountCents: null, minSubtotalCents: null } })
        .discountCents,
    ).toBe(3_000)
  })

  it('fixo maior que o subtotal elegível não deixa o pedido negativo', () => {
    const result = evaluate({
      discount: { kind: 'fixed', value: 99_000, maxDiscountCents: null, minSubtotalCents: null },
      scope: { kind: 'products', productIds: ['p2'] },
    })
    expect(result.discountCents).toBe(5_000)
  })

  it('teto limita o percentual', () => {
    expect(
      evaluate({ discount: { kind: 'percent', value: 50, maxDiscountCents: 4_000, minSubtotalCents: null } })
        .discountCents,
    ).toBe(4_000)
  })

  it('meio centavo arredonda para cima', () => {
    expect(
      computeDiscountCents({
        discount: { kind: 'percent', value: 15, maxDiscountCents: null, minSubtotalCents: null },
        eligibleSubtotalCents: 1_010,
      }),
    ).toBe(152)
  })
})

describe('período', () => {
  it('antes do início: not_started (início inclusivo)', () => {
    expect(evaluate({ startsAt: '2026-11-20T12:00:00.001Z' }).reasons).toEqual([COUPON_REJECTION.NOT_STARTED])
    expect(evaluate({ startsAt: '2026-11-20T12:00:00.000Z' }).valid).toBe(true)
  })

  it('no instante do fim já expirou (fim exclusivo)', () => {
    expect(evaluate({ endsAt: '2026-11-20T12:00:00.000Z' }).reasons).toEqual([COUPON_REJECTION.EXPIRED])
    expect(evaluate({ endsAt: '2026-11-20T12:00:00.001Z' }).valid).toBe(true)
  })

  it('fuso do instante é respeitado', () => {
    expect(evaluate({ endsAt: '2026-11-20T09:00:00-03:00' }).valid).toBe(false)
  })
})

describe('campanha e código', () => {
  it('campanha desligada e código desativado aparecem juntos', () => {
    const result = evaluate({ isActive: false }, { couponStatus: 'disabled' })
    expect(result.reasons).toEqual([COUPON_REJECTION.CAMPAIGN_INACTIVE, COUPON_REJECTION.COUPON_DISABLED])
    expect(result.discountCents).toBe(0)
  })

  it('automática (sem código) ignora o limite por código', () => {
    const result = evaluateCampaign({
      campaign: { ...BASE, usageLimitPerCode: 1 },
      items: CART,
      at: AT,
      usage: { totalUsed: 0, codeUsed: 9 },
    })
    expect(result.valid).toBe(true)
  })
})

describe('limites', () => {
  it('total esgotado', () => {
    expect(evaluate({ usageLimitTotal: 3 }, { usage: { totalUsed: 3, codeUsed: 0 } }).reasons).toEqual([
      COUPON_REJECTION.TOTAL_LIMIT_REACHED,
    ])
    expect(evaluate({ usageLimitTotal: 3 }, { usage: { totalUsed: 2, codeUsed: 0 } }).valid).toBe(true)
  })

  it('por código esgotado', () => {
    expect(evaluate({ usageLimitPerCode: 1 }, { usage: { totalUsed: 1, codeUsed: 1 } }).reasons).toEqual([
      COUPON_REJECTION.CODE_LIMIT_REACHED,
    ])
  })

  it('por cliente esgotado', () => {
    const result = evaluate(
      { usageLimitPerCustomer: 1 },
      { customerRef: 'c-1', usage: { totalUsed: 5, codeUsed: 5, customerUsed: 1 } },
    )
    expect(result.reasons).toEqual([COUPON_REJECTION.CUSTOMER_LIMIT_REACHED])
  })

  it('limite por cliente sem cliente: recusa no resgate, deixa passar na prévia', () => {
    expect(evaluate({ usageLimitPerCustomer: 1 }, { requireCustomer: true }).reasons).toEqual([
      COUPON_REJECTION.CUSTOMER_REQUIRED,
    ])
    expect(evaluate({ usageLimitPerCustomer: 1 }, { requireCustomer: false }).valid).toBe(true)
  })
})

describe('escopo e carrinho', () => {
  it('por produto, categoria e tag somam só o elegível', () => {
    expect(evaluate({ scope: { kind: 'products', productIds: ['p2'] } }).eligibleSubtotalCents).toBe(5_000)
    expect(evaluate({ scope: { kind: 'categories', categoryIds: ['c1'] } }).discountCents).toBe(2_000)
    expect(evaluate({ scope: { kind: 'tags', tags: ['verao'] } }).eligibleSubtotalCents).toBe(20_000)
  })

  it('nada elegível', () => {
    expect(evaluate({ scope: { kind: 'tags', tags: ['inverno'] } }).reasons).toEqual([
      COUPON_REJECTION.NO_ELIGIBLE_ITEMS,
    ])
  })

  it('carrinho vazio', () => {
    expect(evaluate({}, { items: [] }).reasons).toEqual([COUPON_REJECTION.EMPTY_CART])
  })

  it('subtotal mínimo compara o elegível', () => {
    const discount = { kind: 'percent' as const, value: 10, maxDiscountCents: null, minSubtotalCents: 20_001 }
    expect(evaluate({ discount, scope: { kind: 'categories', categoryIds: ['c1'] } }).reasons).toEqual([
      COUPON_REJECTION.MIN_SUBTOTAL_NOT_MET,
    ])
    expect(evaluate({ discount }).valid).toBe(true)
  })

  it('todos os motivos de uma vez', () => {
    const result = evaluate(
      { isActive: false, endsAt: '2026-01-01T00:00:00Z', usageLimitTotal: 1 },
      { usage: { totalUsed: 1, codeUsed: 0 }, items: [] },
    )
    expect(result.reasons).toEqual([
      COUPON_REJECTION.CAMPAIGN_INACTIVE,
      COUPON_REJECTION.EXPIRED,
      COUPON_REJECTION.TOTAL_LIMIT_REACHED,
      COUPON_REJECTION.EMPTY_CART,
    ])
  })
})

describe('situação da campanha', () => {
  it('encerrada, desligada, agendada, no ar', () => {
    expect(campaignState({ isActive: true, startsAt: null, endsAt: '2026-11-20T12:00:00Z' }, AT)).toBe('ended')
    expect(campaignState({ isActive: false, startsAt: null, endsAt: null }, AT)).toBe('inactive')
    expect(campaignState({ isActive: true, startsAt: '2026-11-21T00:00:00Z', endsAt: null }, AT)).toBe('scheduled')
    expect(campaignState({ isActive: true, startsAt: null, endsAt: null }, AT)).toBe('running')
  })
})

describe('desconto zero', () => {
  it('1% de 10 centavos arredonda para zero: não vale', () => {
    const result = evaluate(
      { discount: { kind: 'percent', value: 1, maxDiscountCents: null, minSubtotalCents: null } },
      { items: [{ productId: 'p', priceCents: 10, quantity: 1 }] },
    )
    expect(result).toMatchObject({ valid: false, discountCents: 0, reasons: [COUPON_REJECTION.ZERO_DISCOUNT] })
  })
})
