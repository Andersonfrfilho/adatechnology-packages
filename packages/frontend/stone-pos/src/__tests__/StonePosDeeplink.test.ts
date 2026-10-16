/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it, jest } from 'bun:test'
import type { Spec } from '../NativeStonePos'
import { StonePosError } from '../StonePosError'
import { createStonePosDeeplink } from '../StonePosDeeplink'

function buildNative(overrides: Partial<Record<keyof Spec, jest.Mock>>): Spec {
  return {
    isAvailable: jest.fn(),
    getDeviceInfo: jest.fn(),
    pay: jest.fn(),
    cancel: jest.fn(),
    print: jest.fn(),
    consumeOrphanReturns: jest.fn(),
    abandonPendingOperation: jest.fn(),
    setKeepScreenOn: jest.fn(),
    ...overrides,
  } as unknown as Spec
}

const request = { amountCents: 1000, method: 'DEBIT' as const }

describe('createStonePosDeeplink', () => {
  it('throws a typed parse error carrying the payload when the JSON is invalid', async () => {
    const pos = createStonePosDeeplink(buildNative({ pay: jest.fn().mockResolvedValue('not json') }))
    const error = await pos.pay(request).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(StonePosError)
    expect(error).toMatchObject({ code: 'STONE_PARSE_ERROR', rawUri: 'not json' })
  })

  it('throws a typed parse error when the payload fails validation', async () => {
    const pos = createStonePosDeeplink(buildNative({ pay: jest.fn().mockResolvedValue('{"approved":1}') }))
    await expect(pos.pay(request)).rejects.toMatchObject({ code: 'STONE_PARSE_ERROR' })
  })

  it('converts the native parse rejection into a typed error with the raw uri', async () => {
    const rejection = Object.assign(new Error('Could not read; rawUri=comandada://pay-response?code=0'), {
      code: 'STONE_PARSE_ERROR',
    })
    const pos = createStonePosDeeplink(buildNative({ pay: jest.fn().mockRejectedValue(rejection) }))
    await expect(pos.pay(request)).rejects.toMatchObject({
      code: 'STONE_PARSE_ERROR',
      rawUri: 'comandada://pay-response?code=0',
    })
  })

  it('lets other native errors through untouched', async () => {
    const rejection = Object.assign(new Error('busy'), { code: 'STONE_BUSY' })
    const pos = createStonePosDeeplink(buildNative({ cancel: jest.fn().mockRejectedValue(rejection) }))
    await expect(pos.cancel({ atk: 'A', amountCents: 100 })).rejects.toBe(rejection)
  })

  it('accepts non-string raw values and stringifies them', async () => {
    const payload = JSON.stringify({
      approved: true,
      cancelledByUser: false,
      code: '0',
      raw: { code: '0', installment_count: 3 },
    })
    const pos = createStonePosDeeplink(buildNative({ pay: jest.fn().mockResolvedValue(payload) }))
    const result = await pos.pay(request)
    expect(result.raw).toEqual({ code: '0', installment_count: '3' })
  })

  it('sends print options and reports diagnostics', async () => {
    const print = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({ status: 'SUCCESS', rawUri: 'comandada://print-response', warning: 'UNKNOWN_PRINT_STATUS' }),
      )
    const onPrintDiagnostic = jest.fn()
    const pos = createStonePosDeeplink(buildNative({ print }), { onPrintDiagnostic })
    const status = await pos.print([{ type: 'line', content: 'A' }], { showFeedback: true, timeoutMs: 5000 })
    expect(status).toBe('SUCCESS')
    expect(print.mock.calls[0]?.[1]).toBe('{"showFeedback":true,"timeoutMs":5000}')
    expect(onPrintDiagnostic).toHaveBeenCalledWith({
      rawUri: 'comandada://print-response',
      warning: 'UNKNOWN_PRINT_STATUS',
    })
  })

  it('maps an unrecognised print status to UNKNOWN', async () => {
    const print = jest.fn().mockResolvedValue(JSON.stringify({ status: 'WHATEVER' }))
    const pos = createStonePosDeeplink(buildNative({ print }))
    expect(await pos.print([])).toBe('UNKNOWN')
    expect(print.mock.calls[0]?.[1]).toBe('{}')
  })

  it('parses orphan returns', async () => {
    const orphans = [{ kind: 'PAY' as const, uri: 'comandada://pay-response?code=0', receivedAt: 5 }]
    const pos = createStonePosDeeplink(
      buildNative({ consumeOrphanReturns: jest.fn().mockResolvedValue(JSON.stringify(orphans)) }),
    )
    expect(await pos.consumeOrphanReturns()).toEqual(orphans)
  })
})
