/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { afterAll, beforeEach, describe, expect, it, jest, mock } from 'bun:test'

const mockNative = {
  getConstants: jest.fn(),
  isAvailable: jest.fn(),
  getDeviceInfo: jest.fn(),
  pay: jest.fn(),
  cancel: jest.fn(),
  print: jest.fn(),
  abandonPendingOperation: jest.fn(),
  setKeepScreenOn: jest.fn(),
}

mock.module('../NativeStonePos', () => ({ default: mockNative }))

const { getStonePos, getStonePosBuildEnvironment, resetStonePosForTests } = await import('..')

const globalWithDev = globalThis as { __DEV__?: boolean }
describe('getStonePos', () => {
  const originalDev = globalWithDev.__DEV__

  beforeEach(() => {
    resetStonePosForTests()
    jest.clearAllMocks()
  })

  afterAll(() => {
    globalWithDev.__DEV__ = originalDev
  })

  it('uses the native module when the Stone apps respond', async () => {
    mockNative.isAvailable.mockResolvedValue(true)
    mockNative.pay.mockResolvedValue(
      JSON.stringify({
        approved: true,
        cancelledByUser: false,
        code: '0',
        atk: 'ATK1',
        instantPaymentId: 'E2E1',
        raw: { code: '0' },
      }),
    )
    const pos = await getStonePos()
    const result = await pos.pay({
      amountCents: 14300,
      method: 'CREDIT',
      installments: { kind: 'ISSUER', count: 2 },
      orderId: '27',
    })
    expect(JSON.parse(String(mockNative.pay.mock.calls[0]?.[0]))).toEqual({
      amountCents: 14300,
      transactionType: 'CREDIT',
      installmentType: 'ISSUER',
      installmentCount: 2,
      orderId: '27',
      editableAmount: false,
    })
    expect(result).toMatchObject({ approved: true, atk: 'ATK1', endToEndId: 'E2E1' })
  })

  it('falls back to the mock in development when the Stone apps are missing', async () => {
    globalWithDev.__DEV__ = true
    mockNative.isAvailable.mockResolvedValue(false)
    const pos = await getStonePos()
    expect((await pos.getDeviceInfo()).model).toBe('Mock POS')
  })

  it('throws a clear error in release when the Stone apps are missing', async () => {
    globalWithDev.__DEV__ = false
    mockNative.isAvailable.mockResolvedValue(false)
    await expect(getStonePos()).rejects.toThrow('Maquininha Stone indisponivel')
  })
})

describe('getStonePosBuildEnvironment', () => {
  it('reads the environment injected by the host app', () => {
    mockNative.getConstants.mockReturnValue({ buildEnvironment: 'staging' })
    expect(getStonePosBuildEnvironment()).toBe('staging')
  })
})
