/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it, jest } from 'bun:test'
import { createStonePosMock } from '../StonePosMock'

describe('StonePosMock', () => {
  const mock = () => createStonePosMock({ delayMs: 0, now: () => 1000 })

  it('approves amounts from R$ 2,00', async () => {
    const result = await mock().pay({ amountCents: 200, method: 'CREDIT' })
    expect(result.approved).toBe(true)
    expect(result.code).toBe('0')
    expect(result.atk).toBeDefined()
  })

  it('declines amounts below R$ 2,00', async () => {
    const result = await mock().pay({ amountCents: 199, method: 'DEBIT' })
    expect(result.approved).toBe(false)
  })

  it('declines amounts ending in 13 cents', async () => {
    const result = await mock().pay({ amountCents: 15013, method: 'CREDIT' })
    expect(result.approved).toBe(false)
    expect(result.cancelledByUser).toBe(false)
  })

  it('returns an end-to-end id instead of atk for Pix', async () => {
    const result = await mock().pay({ amountCents: 5000, method: 'PIX' })
    expect(result.endToEndId).toBeDefined()
    expect(result.atk).toBeUndefined()
    expect(result.type).toBe('INSTANT_PAYMENT')
  })

  it('keeps installment count', async () => {
    const result = await mock().pay({
      amountCents: 9600,
      method: 'CREDIT',
      installments: { kind: 'MERCHANT', count: 3 },
    })
    expect(result.installmentCount).toBe(3)
  })

  it('keeps printed copies observable and notifies subscribers', async () => {
    const pos = mock()
    const listener = jest.fn()
    const unsubscribe = pos.subscribe(listener)
    const status = await pos.print([{ type: 'line', content: 'FICHA 004' }])
    expect(status).toBe('SUCCESS')
    expect(pos.printedCopies()).toEqual([{ lines: [{ type: 'line', content: 'FICHA 004' }], printedAt: 1000 }])
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    pos.clearPrintedCopies()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(pos.printedCopies()).toEqual([])
  })

  it('cancels successfully and reports not available', async () => {
    const pos = mock()
    expect((await pos.cancel({ atk: 'A', amountCents: 100 })).success).toBe(true)
    expect(await pos.isAvailable()).toBe(false)
    expect((await pos.getDeviceInfo()).model).toBe('Mock POS')
  })
})

describe('StonePosMock orphan returns', () => {
  it('has no orphan returns', async () => {
    expect(await createStonePosMock({ delayMs: 0 }).consumeOrphanReturns()).toEqual([])
  })
})
