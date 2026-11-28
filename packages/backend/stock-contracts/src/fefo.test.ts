/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { parseDecimal } from '@adatechnology/recipe-contracts'

import { planFefoConsumption } from './fefo'
import { deductOrderSchema, receiveBatchSchema } from './schemas'

const BATCHES = [
  { id: 'no-expiry', remainingQuantity: '10', expiresAt: null, receivedAt: '2026-01-01T00:00:00Z' },
  { id: 'late', remainingQuantity: '2', expiresAt: '2026-03-10T00:00:00Z', receivedAt: '2026-01-02T00:00:00Z' },
  { id: 'soon', remainingQuantity: '1.5', expiresAt: '2026-02-01T00:00:00Z', receivedAt: '2026-01-03T00:00:00Z' },
  { id: 'empty', remainingQuantity: '0', expiresAt: '2026-01-15T00:00:00Z', receivedAt: '2026-01-03T00:00:00Z' },
]

describe('FEFO', () => {
  it('consome do que vence antes; sem validade por último', () => {
    const plan = planFefoConsumption({ batches: BATCHES, quantity: parseDecimal('4') })
    expect(plan.allocations).toEqual([
      { batchId: 'soon', quantity: '1.5000', remainingAfter: '0.0000' },
      { batchId: 'late', quantity: '2.0000', remainingAfter: '0.0000' },
      { batchId: 'no-expiry', quantity: '0.5000', remainingAfter: '9.5000' },
    ])
    expect(plan.uncovered).toBe('0.0000')
  })

  it('o que não cabe em lote fica descoberto', () => {
    expect(planFefoConsumption({ batches: BATCHES, quantity: parseDecimal('20') }).uncovered).toBe('6.5000')
    expect(planFefoConsumption({ batches: [], quantity: parseDecimal('1') }).uncovered).toBe('1.0000')
  })
})

describe('schemas', () => {
  it('entrada de lote: validade com fuso, custo opcional', () => {
    const parsed = receiveBatchSchema.parse({
      ingredientId: '7b0f2a52-5f3a-4a39-9d0e-6a3a7f1d2c11',
      quantity: '2,5',
      batchCode: 'L-01',
      expiresAt: '2026-02-01T00:00:00-03:00',
    })
    expect(parsed.quantity).toBe('2.5000')
    expect(receiveBatchSchema.safeParse({ ...parsed, expiresAt: '2026-02-01' }).success).toBe(false)
  })

  it('baixa por pedido exige chave de linha', () => {
    expect(deductOrderSchema.safeParse({ orderId: 'o1', lines: [{ productId: 'p', quantity: '1' }] }).success).toBe(
      false,
    )
  })
})
