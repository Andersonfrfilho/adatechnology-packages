/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createCampaignSchema, createItemSchema, feedQuerySchema, recommendationModuleConfigSchema } from './schemas'
import { ItemNotFoundError, PlanNotEntitledError, RECOMMENDATION_ERROR_CODE } from './errors'

const config = {
  tenancy: { mode: 'single' as const },
  kinds: [{ name: 'place', label: 'Lugar', fields: [] }],
  plans: [{ name: 'featured', label: 'Destaque', weight: 10 }],
  placements: [{ name: 'home', label: 'Início' }],
}

describe('configuração de boot', () => {
  it('aceita a configuração mínima', () => {
    expect(recommendationModuleConfigSchema.safeParse(config).success).toBe(true)
  })

  it('recusa tipo repetido — o segundo nunca seria escolhido', () => {
    const kinds = [config.kinds[0], config.kinds[0]]
    expect(recommendationModuleConfigSchema.safeParse({ ...config, kinds }).success).toBe(false)
  })

  it('recusa `select` sem opção', () => {
    const kinds = [
      { name: 'place', label: 'Lugar', fields: [{ name: 'tipo', label: 'Tipo', type: 'select', required: true }] },
    ]
    expect(recommendationModuleConfigSchema.safeParse({ ...config, kinds }).success).toBe(false)
  })
})

describe('item', () => {
  const base = { kind: 'place', source: 'curated', title: 'Parque' }

  it('recusa link `javascript:` — vira script na sessão de quem clica', () => {
    expect(createItemSchema.safeParse({ ...base, linkUrl: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('aceita link https', () => {
    expect(createItemSchema.safeParse({ ...base, linkUrl: 'https://exemplo.com.br' }).success).toBe(true)
  })

  it('recusa faixa de idade invertida', () => {
    expect(createItemSchema.safeParse({ ...base, minAge: 10, maxAge: 3 }).success).toBe(false)
  })

  it('normaliza tags para minúsculas', () => {
    const parsed = createItemSchema.parse({ ...base, tags: [' Ar Livre '] })
    expect(parsed.tags).toEqual(['ar livre'])
  })
})

describe('campanha', () => {
  it('recusa fim antes do início', () => {
    const parsed = createCampaignSchema.safeParse({
      plan: 'featured',
      startsAt: '2026-11-10T00:00:00Z',
      endsAt: '2026-11-01T00:00:00Z',
    })
    expect(parsed.success).toBe(false)
  })

  it('sem espaços, roda em todos', () => {
    const parsed = createCampaignSchema.parse({ plan: 'featured', startsAt: '2026-11-10T00:00:00Z' })
    expect(parsed.placements).toEqual([])
    expect(parsed.priority).toBe(0)
  })
})

describe('feed', () => {
  it('lê idade, limite e tags da query string', () => {
    const parsed = feedQuerySchema.parse({ placement: 'home', age: '4', limit: '3', tags: 'Parque, ,praia' })
    expect(parsed).toEqual({ placement: 'home', age: 4, limit: 3, tags: ['parque', 'praia'] })
  })
})

describe('erros', () => {
  it('trazem o status HTTP pela forma que o module-http reconhece', () => {
    expect(new ItemNotFoundError().statusCode).toBe(404)
    const entitlement = new PlanNotEntitledError('featured')
    expect(entitlement.statusCode).toBe(402)
    expect(entitlement.code).toBe(RECOMMENDATION_ERROR_CODE.PLAN_NOT_ENTITLED)
  })
})
