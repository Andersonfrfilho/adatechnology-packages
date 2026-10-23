/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type PaymentMethod = 'CREDIT' | 'DEBIT' | 'PIX' | 'VOUCHER'

export type Installments = { readonly kind: 'NONE' } | { readonly kind: 'MERCHANT' | 'ISSUER'; readonly count: number }

export type PaymentRequest = {
  readonly amountCents: number
  readonly method: PaymentMethod
  readonly installments?: Installments
  readonly orderId?: string
}

export type PaymentResult = {
  readonly approved: boolean
  readonly cancelledByUser: boolean
  readonly code: string
  readonly message?: string
  readonly amountCents?: number
  readonly itk?: string
  readonly atk?: string
  readonly authorizationCode?: string
  readonly brand?: string
  readonly installmentCount?: number
  readonly type?: PaymentMethod | 'INSTANT_PAYMENT'
  readonly pan?: string
  readonly authorizationDateTime?: string
  readonly endToEndId?: string
  readonly raw: Readonly<Record<string, string>>
}

export type CancelRequest = {
  readonly atk: string
  readonly amountCents: number
}

export type CancelResult = {
  readonly success: boolean
  readonly code?: string
  readonly message?: string
  readonly raw: Readonly<Record<string, string>>
}

export type PrintStatus =
  | 'SUCCESS'
  | 'PRINTER_OUT_OF_PAPER'
  | 'PRINTER_INIT_ERROR'
  | 'PRINTER_LOW_ENERGY'
  | 'PRINTER_BUSY'
  | 'PRINTER_UNSUPPORTED_FORMAT'
  | 'PRINTER_INVALID_DATA'
  | 'PRINTER_OVERHEATING'
  | 'PRINTER_PAPER_JAM'
  | 'PRINTER_PRINT_ERROR'
  | 'UNKNOWN'

export type PrintOptions = {
  readonly showFeedback?: boolean
  readonly timeoutMs?: number
  // Draws the receipt as one black-and-white image: the Stone text fonts print faint.
  readonly renderAsImage?: boolean
}

export type DeviceInfo = {
  readonly model: string
  readonly manufacturer: string
  readonly serial?: string
}

export type StonePosErrorCode =
  | 'STONE_BUSY'
  | 'STONE_UNAVAILABLE'
  | 'STONE_INVALID_PARAMS'
  | 'STONE_PARSE_ERROR'
  | 'STONE_ABANDONED'
  | 'STONE_PRINT_TIMEOUT'

export type OrphanReturn = {
  readonly kind: 'PAY' | 'CANCEL' | 'PRINT'
  readonly uri: string
  readonly receivedAt: number
}

export type PrintDiagnostic = {
  readonly rawUri?: string
  readonly warning?: string
}

export type PrintLine =
  | {
      readonly type: 'text'
      readonly content: string
      readonly align?: 'left' | 'center' | 'right'
      readonly size?: 'small' | 'medium' | 'big'
    }
  | { readonly type: 'line'; readonly content: string }
  | { readonly type: 'image'; readonly imagePath: string }
