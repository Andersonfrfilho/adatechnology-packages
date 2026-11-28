/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { formatBasisPoints, formatMoney, fromInputDecimal, toInputDecimal } from './format'
import { buildPageItems } from './pagination'

describe('format', () => {
  it('campo no idioma e volta exato para o contrato', () => {
    expect(toInputDecimal({ value: '12.5000', locale: 'pt-BR' })).toBe('12,5')
    expect(toInputDecimal({ value: '3.0000', locale: 'en' })).toBe('3')
    expect(fromInputDecimal('12,5')).toBe('12.5000')
    expect(fromInputDecimal('1.2.3')).toBeUndefined()
    expect(fromInputDecimal('0,00001')).toBeUndefined()
  })

  it('moeda e percentual', () => {
    expect(formatMoney({ value: '32.9000', locale: 'pt-BR', currency: 'BRL' }).replace(/\s/g, ' ')).toBe('R$ 32,90')
    expect(formatBasisPoints({ basisPoints: 3250, locale: 'pt-BR' }).replace(/\s/g, '')).toBe('32,5%')
  })
})

describe('paginação', () => {
  it('janela curta com reticências', () => {
    expect(buildPageItems({ current: 5, total: 10 }).map((item) => (item.kind === 'gap' ? '…' : item.page))).toEqual([
      1,
      '…',
      4,
      5,
      6,
      '…',
      10,
    ])
  })
})
