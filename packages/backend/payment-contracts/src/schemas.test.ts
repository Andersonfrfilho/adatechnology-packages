/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { planCatalogSchema } from './schemas'

const free = { code: 'free', name: 'Gratuito', interval: 'none', features: [], offers: [], isFree: true } as const
const monthly = {
  code: 'premium_monthly',
  name: 'Premium',
  interval: 'month',
  features: ['ai'],
  offers: [{ provider: 'hotmart', offerCode: 'abc', checkoutUrl: 'https://pay.hotmart.com/X?off=abc' }],
} as const

describe('catálogo de planos', () => {
  test('aceita um gratuito e planos pagos com ofertas', () => {
    expect(planCatalogSchema.safeParse([free, monthly]).success).toBe(true)
  })

  test('recusa catálogo sem plano gratuito, com dois, com código ou oferta repetidos', () => {
    expect(planCatalogSchema.safeParse([monthly]).success).toBe(false)
    expect(planCatalogSchema.safeParse([free, { ...free, code: 'free2' }]).success).toBe(false)
    expect(planCatalogSchema.safeParse([free, monthly, monthly]).success).toBe(false)
    expect(planCatalogSchema.safeParse([free, monthly, { ...monthly, code: 'other' }]).success).toBe(false)
  })
})
