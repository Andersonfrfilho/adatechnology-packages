/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  CancelRequest,
  CancelResult,
  DeviceInfo,
  OrphanReturn,
  PaymentRequest,
  PaymentResult,
  PrintLine,
  PrintOptions,
  PrintStatus,
} from './types'

export interface StonePos {
  isAvailable(): Promise<boolean>
  getDeviceInfo(): Promise<DeviceInfo>
  pay(request: PaymentRequest): Promise<PaymentResult>
  cancel(request: CancelRequest): Promise<CancelResult>
  print(lines: readonly PrintLine[], options?: PrintOptions): Promise<PrintStatus>
  abandonPendingOperation(): Promise<void>
  consumeOrphanReturns(): Promise<OrphanReturn[]>
  setKeepScreenOn(enabled: boolean): Promise<void>
}
