/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { createProductSchema, updateProductSchema } from './schemas'

const base = { name: 'Item', priceInCents: 1000 }

function parseCreate(orderEligibility: unknown) {
  return createProductSchema.safeParse({ ...base, attributes: { orderEligibility } })
}

describe('attributes.orderEligibility', () => {
  it('aceita idade 0..21 e audiência válida', () => {
    expect(parseCreate({ minimumAge: 18, audience: 'staying_guests' }).success).toBe(true)
    expect(parseCreate({ minimumAge: 0 }).success).toBe(true)
    expect(parseCreate({ minimumAge: 21, audience: 'everyone' }).success).toBe(true)
    expect(parseCreate({}).success).toBe(true)
  })

  it('null em minimumAge = sem restrição', () => {
    expect(parseCreate({ minimumAge: null }).success).toBe(true)
  })

  it('rejeita idade fora da faixa, fracionária ou não numérica', () => {
    for (const minimumAge of [-1, 22, 17.5, '18']) {
      expect(parseCreate({ minimumAge }).success).toBe(false)
    }
  })

  it('rejeita audiência desconhecida e chaves extras', () => {
    expect(parseCreate({ audience: 'vip' }).success).toBe(false)
    expect(parseCreate({ minimumAge: 18, extra: true }).success).toBe(false)
  })

  it('o erro aponta para attributes.orderEligibility', () => {
    const result = parseCreate({ minimumAge: 40 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['attributes', 'orderEligibility', 'minimumAge'])
    }
  })

  it('vale também no update, e as outras chaves de attributes continuam livres', () => {
    expect(updateProductSchema.safeParse({ attributes: { orderEligibility: { minimumAge: 30 } } }).success).toBe(false)
    expect(
      updateProductSchema.safeParse({ attributes: { capacity: 4, orderEligibility: { minimumAge: 18 } } }).success,
    ).toBe(true)
  })

  it('produto sem a chave continua válido (compatível com o que já existe)', () => {
    expect(createProductSchema.safeParse({ ...base, attributes: { capacity: 4 } }).success).toBe(true)
    expect(createProductSchema.safeParse(base).success).toBe(true)
  })
})
