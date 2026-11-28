/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  add,
  divide,
  formatDecimal,
  fromCents,
  multiply,
  normalizeDecimal,
  parseDecimal,
  ROUNDING,
  toCents,
} from './decimal'
import { convertQuantity, compatibleUnits } from './units'

describe('decimal exato', () => {
  it('0,1 + 0,2 é 0,3 (sem ponto flutuante)', () => {
    expect(formatDecimal(add(parseDecimal('0.1'), parseDecimal('0.2')))).toBe('0.3000')
  })

  it('normaliza para 4 casas e aceita o texto do Postgres', () => {
    expect(normalizeDecimal('2.5')).toBe('2.5000')
    expect(normalizeDecimal('12.50000000')).toBe('12.5000')
    expect(normalizeDecimal('-3')).toBe('-3.0000')
  })

  it('arredonda meio para cima, para cima e para baixo', () => {
    const third = divide(parseDecimal('1'), parseDecimal('3'))
    expect(formatDecimal(third)).toBe('0.3333')
    expect(formatDecimal(third, 4, ROUNDING.UP)).toBe('0.3334')
    expect(formatDecimal(parseDecimal('0.00005'))).toBe('0.0001')
    expect(formatDecimal(parseDecimal('-0.00005'))).toBe('-0.0001')
    expect(formatDecimal(parseDecimal('0.00009'), 4, ROUNDING.DOWN)).toBe('0.0000')
  })

  it('centavos inteiros', () => {
    expect(toCents(parseDecimal('6.005'))).toBe(601)
    expect(toCents(multiply(parseDecimal('0.2'), parseDecimal('32.9')))).toBe(658)
    expect(formatDecimal(fromCents(1999), 2)).toBe('19.99')
  })

  it('recusa texto que não é número', () => {
    expect(() => parseDecimal('1e3')).toThrow()
    expect(() => parseDecimal('abc')).toThrow()
  })
})

describe('unidades', () => {
  it('converte dentro da dimensão, exato', () => {
    expect(formatDecimal(convertQuantity({ quantity: parseDecimal('200'), from: 'g', to: 'kg' })!)).toBe('0.2000')
    expect(formatDecimal(convertQuantity({ quantity: parseDecimal('1.5'), from: 'l', to: 'ml' })!)).toBe('1500.0000')
    expect(formatDecimal(convertQuantity({ quantity: parseDecimal('2'), from: 'dz', to: 'un' })!)).toBe('24.0000')
  })

  it('massa não vira volume nem contagem', () => {
    expect(convertQuantity({ quantity: parseDecimal('1'), from: 'kg', to: 'l' })).toBeUndefined()
    expect(compatibleUnits('kg')).toEqual(['mg', 'g', 'kg'])
  })
})
