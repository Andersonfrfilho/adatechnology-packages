/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { StonePos } from './StonePos'
import type { PaymentRequest, PaymentResult, PrintLine } from './types'

const MIN_APPROVED_CENTS = 200
const DECLINED_CENTS_SUFFIX = 13
const MOCK_DELAY_MS = 400

export type PrintedCopy = {
  readonly lines: readonly PrintLine[]
  readonly printedAt: number
}

export type StonePosMock = StonePos & {
  readonly printedCopies: () => readonly PrintedCopy[]
  readonly subscribe: (listener: () => void) => () => void
  readonly clearPrintedCopies: () => void
}

type MockOptions = {
  readonly delayMs?: number
  readonly now?: () => number
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function buildResult(request: PaymentRequest, sequence: number): PaymentResult {
  const isDeclined = request.amountCents < MIN_APPROVED_CENTS || request.amountCents % 100 === DECLINED_CENTS_SUFFIX
  if (isDeclined) {
    return {
      approved: false,
      cancelledByUser: false,
      code: '-6',
      message: 'Transacao recusada (mock)',
      amountCents: request.amountCents,
      raw: { code: '-6', reason: '1016' },
    }
  }
  const id = String(sequence).padStart(6, '0')
  const isPix = request.method === 'PIX'
  return {
    approved: true,
    cancelledByUser: false,
    code: '0',
    amountCents: request.amountCents,
    itk: `MOCK-ITK-${id}`,
    ...(isPix ? { endToEndId: `MOCKE2E${id}` } : { atk: `MOCK-ATK-${id}` }),
    authorizationCode: id,
    brand: isPix ? 'PIX' : 'VISA',
    installmentCount: request.installments?.kind === 'NONE' ? 1 : (request.installments?.count ?? 1),
    type: isPix ? 'INSTANT_PAYMENT' : request.method,
    raw: { code: '0', amount: String(request.amountCents) },
  }
}

export function createStonePosMock(options: MockOptions = {}): StonePosMock {
  const delayMs = options.delayMs ?? MOCK_DELAY_MS
  const now = options.now ?? Date.now
  let printed: readonly PrintedCopy[] = []
  let sequence = 0
  const listeners = new Set<() => void>()

  return {
    isAvailable: async () => false,
    getDeviceInfo: async () => ({ model: 'Mock POS', manufacturer: 'Stone' }),
    async pay(request) {
      await wait(delayMs)
      sequence += 1
      return buildResult(request, sequence)
    },
    async cancel() {
      await wait(delayMs)
      return { success: true, code: '0', raw: { success: 'true' } }
    },
    async print(lines) {
      await wait(delayMs / 2)
      printed = [...printed, { lines, printedAt: now() }]
      listeners.forEach((listener) => listener())
      return 'SUCCESS'
    },
    abandonPendingOperation: async () => undefined,
    consumeOrphanReturns: async () => [],
    setKeepScreenOn: async () => undefined,
    printedCopies: () => printed,
    clearPrintedCopies() {
      printed = []
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
