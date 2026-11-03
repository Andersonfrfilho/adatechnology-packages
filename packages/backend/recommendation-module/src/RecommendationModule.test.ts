/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { ConfigInvalidError } from '@adatechnology/recommendation-contracts'

import { createRecommendationModule } from './RecommendationModule'

describe('createRecommendationModule', () => {
  it('configuração inválida derruba o boot, não a primeira requisição', () => {
    expect(() =>
      createRecommendationModule({
        db: {} as never,
        config: { tenancy: { mode: 'single' }, kinds: [], plans: [], placements: [] },
      }),
    ).toThrow(ConfigInvalidError)
  })

  it('fuso desconhecido também derruba o boot', () => {
    expect(() =>
      createRecommendationModule({
        db: {} as never,
        config: {
          tenancy: { mode: 'single' },
          timeZone: 'Marte/Olympus',
          kinds: [{ name: 'place', label: 'Lugar', fields: [] }],
          plans: [{ name: 'featured', label: 'Destaque', weight: 1 }],
          placements: [{ name: 'home', label: 'Início' }],
        },
      }),
    ).toThrow(ConfigInvalidError)
  })
})
