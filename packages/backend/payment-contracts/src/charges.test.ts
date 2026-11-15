/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { REFUND_STATUS_VALUES, supportsRefunds } from './charges'
import type { ChargeProviderPort } from './charges'

const base: ChargeProviderPort = {
  chargeKinds: ['pix'],
  createCharge: async () => {
    throw new Error('não usado')
  },
}

describe('supportsRefunds', () => {
  test('provedor sem refundCharge não estorna', () => {
    expect(supportsRefunds(base)).toBe(false)
  })

  test('provedor com refundCharge estorna', () => {
    expect(
      supportsRefunds({
        ...base,
        refundCharge: async () => {
          throw new Error('não usado')
        },
      }),
    ).toBe(true)
  })

  test('estados do estorno', () => {
    expect(REFUND_STATUS_VALUES).toEqual(['approved', 'pending', 'failed'])
  })
})
