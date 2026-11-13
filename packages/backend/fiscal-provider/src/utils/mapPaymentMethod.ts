import type { PaymentMethod } from '../types'

const NFCE_PAYMENT_CODES: Record<string, string> = {
  cash: '01',
  money: '01',
  dinheiro: '01',
  card_credit: '03',
  credit: '03',
  credito: '03',
  card_debit: '04',
  debit: '04',
  debito: '04',
  voucher: '05',
  pix: '17',
  PIX: '17',
}

const SAT_PAYMENT_CODES: Record<string, string> = {
  cash: '01',
  money: '01',
  card_credit: '03',
  credit: '03',
  card_debit: '04',
  debit: '04',
  voucher: '05',
  pix: '17',
  PIX: '17',
}

export function toNfcePaymentCode(method: PaymentMethod | string): string {
  const key = String(method ?? '').trim()
  const code = NFCE_PAYMENT_CODES[key] ?? NFCE_PAYMENT_CODES[key.toLowerCase()]
  if (!code) {
    // Fallback seguro: outros (99) — evita tPag vazio → cStat 225
    return '99'
  }
  return code
}

export function toSatPaymentCode(method: PaymentMethod | string): string {
  const key = String(method ?? '').trim()
  return SAT_PAYMENT_CODES[key] ?? SAT_PAYMENT_CODES[key.toLowerCase()] ?? '99'
}
