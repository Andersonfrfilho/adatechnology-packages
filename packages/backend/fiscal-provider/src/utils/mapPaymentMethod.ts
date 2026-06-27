import type { PaymentMethod } from '../types'

const NFCE_PAYMENT_CODES: Record<PaymentMethod, string> = {
  cash: '01',
  card_credit: '03',
  card_debit: '04',
  voucher: '05',
  pix: '17',
}

const SAT_PAYMENT_CODES: Record<PaymentMethod, string> = {
  cash: '01',
  card_credit: '03',
  card_debit: '04',
  voucher: '05',
  pix: '17',
}

export function toNfcePaymentCode(method: PaymentMethod): string {
  return NFCE_PAYMENT_CODES[method]
}

export function toSatPaymentCode(method: PaymentMethod): string {
  return SAT_PAYMENT_CODES[method]
}
