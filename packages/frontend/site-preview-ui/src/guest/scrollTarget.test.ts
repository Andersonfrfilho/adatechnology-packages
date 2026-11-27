/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { computeScrollTop } from './scrollTarget'

const BASE = { viewportHeight: 800, currentScrollTop: 0, documentHeight: 5000 }

describe('computeScrollTop', () => {
  it('não rola quando a seção já cabe inteira na janela', () => {
    expect(computeScrollTop({ ...BASE, elementTop: 100, elementHeight: 300 })).toBeUndefined()
  })

  it('centraliza a seção que está abaixo da janela', () => {
    expect(computeScrollTop({ ...BASE, elementTop: 2000, elementHeight: 400 })).toBe(2200 - 400)
  })

  it('volta até a seção que ficou acima, a partir de uma rolagem longa', () => {
    expect(computeScrollTop({ ...BASE, currentScrollTop: 3000, elementTop: -2400, elementHeight: 400 })).toBe(600 - 200)
  })

  it('alinha ao topo a seção do tamanho da janela ou maior', () => {
    expect(computeScrollTop({ ...BASE, elementTop: 1500, elementHeight: 1200 })).toBe(1500 - 16)
  })

  it('respeita os limites do documento', () => {
    expect(computeScrollTop({ ...BASE, elementTop: 4900, elementHeight: 300, documentHeight: 5000 })).toBe(4200)
    expect(computeScrollTop({ ...BASE, currentScrollTop: 50, elementTop: -50, elementHeight: 100 })).toBe(0)
  })

  it('não rola quando o destino é onde já está', () => {
    expect(
      computeScrollTop({ ...BASE, currentScrollTop: 0, elementTop: -10, elementHeight: 100, documentHeight: 800 }),
    ).toBeUndefined()
  })
})
