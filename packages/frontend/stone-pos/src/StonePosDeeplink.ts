/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { z } from 'zod'

import type { Spec } from './NativeStonePos'
import { StonePosError } from './StonePosError'
import type { StonePos } from './StonePos'
import type {
  CancelRequest,
  CancelResult,
  DeviceInfo,
  OrphanReturn,
  PaymentRequest,
  PaymentResult,
  PrintDiagnostic,
  PrintOptions,
  PrintStatus,
} from './types'

const PARSE_ERROR_CODE = 'STONE_PARSE_ERROR'
const RAW_URI_MARKER = 'rawUri='

export type StonePosDeeplinkOptions = {
  readonly onPrintDiagnostic?: (diagnostic: PrintDiagnostic) => void
}

const PRINT_STATUSES: readonly PrintStatus[] = [
  'SUCCESS',
  'PRINTER_OUT_OF_PAPER',
  'PRINTER_INIT_ERROR',
  'PRINTER_LOW_ENERGY',
  'PRINTER_BUSY',
  'PRINTER_UNSUPPORTED_FORMAT',
  'PRINTER_INVALID_DATA',
  'PRINTER_OVERHEATING',
  'PRINTER_PAPER_JAM',
  'PRINTER_PRINT_ERROR',
  'UNKNOWN',
]

const paymentResultSchema = z.object({
  approved: z.boolean(),
  cancelledByUser: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  amountCents: z.number().optional(),
  itk: z.string().optional(),
  atk: z.string().optional(),
  authorizationCode: z.string().optional(),
  brand: z.string().optional(),
  installmentCount: z.number().optional(),
  type: z.string().optional(),
  pan: z.string().optional(),
  authorizationDateTime: z.string().optional(),
  instantPaymentId: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
})

const cancelResultSchema = z.object({
  success: z.boolean(),
  responseCode: z.string().optional(),
  reason: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
})

const printResultSchema = z.object({
  status: z.string(),
  rawUri: z.string().optional(),
  warning: z.string().optional(),
})

const orphanReturnsSchema = z.array(
  z.object({
    kind: z.enum(['PAY', 'CANCEL', 'PRINT']),
    uri: z.string(),
    receivedAt: z.number(),
  }),
)

const deviceInfoSchema = z.object({
  model: z.string(),
  manufacturer: z.string(),
  serial: z.string().optional(),
})

function isPrintStatus(value: string): value is PrintStatus {
  return (PRINT_STATUSES as readonly string[]).includes(value)
}

function stringifyRaw(raw: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]),
  )
}

function parsePayload<TData>(json: string, schema: z.ZodType<TData>): TData {
  try {
    return schema.parse(JSON.parse(json))
  } catch (error) {
    throw new StonePosError(PARSE_ERROR_CODE, error instanceof Error ? error.message : 'Invalid Stone payload', json)
  }
}

function hasErrorCode(error: unknown, code: string): error is { code: string; message?: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

async function withTypedParseError<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
  try {
    return await operation()
  } catch (error) {
    if (!hasErrorCode(error, PARSE_ERROR_CODE)) throw error
    const message = error.message ?? 'Could not read the Stone response'
    const markerIndex = message.indexOf(RAW_URI_MARKER)
    const rawUri = markerIndex < 0 ? undefined : message.slice(markerIndex + RAW_URI_MARKER.length)
    throw new StonePosError(PARSE_ERROR_CODE, message, rawUri)
  }
}

function toPaymentResult(json: string): PaymentResult {
  const data = parsePayload(json, paymentResultSchema)
  return {
    approved: data.approved,
    cancelledByUser: data.cancelledByUser,
    code: data.code ?? '',
    ...(data.message !== undefined && { message: data.message }),
    ...(data.amountCents !== undefined && { amountCents: data.amountCents }),
    ...(data.itk !== undefined && { itk: data.itk }),
    ...(data.atk !== undefined && { atk: data.atk }),
    ...(data.authorizationCode !== undefined && { authorizationCode: data.authorizationCode }),
    ...(data.brand !== undefined && { brand: data.brand }),
    ...(data.installmentCount !== undefined && { installmentCount: data.installmentCount }),
    ...(data.type !== undefined && { type: data.type as PaymentResult['type'] }),
    ...(data.pan !== undefined && { pan: data.pan }),
    ...(data.authorizationDateTime !== undefined && {
      authorizationDateTime: data.authorizationDateTime,
    }),
    ...(data.instantPaymentId !== undefined && { endToEndId: data.instantPaymentId }),
    raw: stringifyRaw(data.raw),
  }
}

function toCancelResult(json: string): CancelResult {
  const data = parsePayload(json, cancelResultSchema)
  return {
    success: data.success,
    ...(data.responseCode !== undefined && { code: data.responseCode }),
    ...(data.reason !== undefined && { message: data.reason }),
    raw: stringifyRaw(data.raw),
  }
}

function toPaymentParams(request: PaymentRequest): string {
  const installments = request.installments ?? { kind: 'NONE' as const }
  return JSON.stringify({
    amountCents: request.amountCents,
    transactionType: request.method,
    installmentType: installments.kind,
    ...(installments.kind !== 'NONE' && { installmentCount: installments.count }),
    ...(request.orderId !== undefined && { orderId: request.orderId }),
    editableAmount: false,
  })
}

function toPrintOptions(options: PrintOptions | undefined): string {
  return JSON.stringify({
    ...(options?.showFeedback !== undefined && { showFeedback: options.showFeedback }),
    ...(options?.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
  })
}

export function createStonePosDeeplink(native: Spec, deeplinkOptions: StonePosDeeplinkOptions = {}): StonePos {
  return {
    isAvailable: () => native.isAvailable(),
    async getDeviceInfo(): Promise<DeviceInfo> {
      const data = parsePayload(await native.getDeviceInfo(), deviceInfoSchema)
      return {
        model: data.model,
        manufacturer: data.manufacturer,
        ...(data.serial !== undefined && { serial: data.serial }),
      }
    },
    async pay(request) {
      return toPaymentResult(await withTypedParseError(() => native.pay(toPaymentParams(request))))
    },
    async cancel(request: CancelRequest) {
      const params = JSON.stringify({ atk: request.atk, amountCents: request.amountCents })
      return toCancelResult(await withTypedParseError(() => native.cancel(params)))
    },
    async print(lines, options) {
      const json = await withTypedParseError(() => native.print(JSON.stringify(lines), toPrintOptions(options)))
      const data = parsePayload(json, printResultSchema)
      if (data.rawUri !== undefined || data.warning !== undefined) {
        deeplinkOptions.onPrintDiagnostic?.({
          ...(data.rawUri !== undefined && { rawUri: data.rawUri }),
          ...(data.warning !== undefined && { warning: data.warning }),
        })
      }
      return isPrintStatus(data.status) ? data.status : 'UNKNOWN'
    },
    abandonPendingOperation: () => native.abandonPendingOperation(),
    async consumeOrphanReturns(): Promise<OrphanReturn[]> {
      return parsePayload(await native.consumeOrphanReturns(), orphanReturnsSchema)
    },
    setKeepScreenOn: (enabled) => native.setKeepScreenOn(enabled),
  }
}
