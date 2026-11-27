/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { DISCOUNT_KIND, type CampaignDiscount } from '@adatechnology/coupon-contracts'

export function formatCents(cents: number, locale: string, currency = 'BRL'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/** "10%" ou "R$ 25,00". */
export function formatDiscount(discount: CampaignDiscount, locale: string, currency = 'BRL'): string {
  return discount.kind === DISCOUNT_KIND.PERCENT ? `${discount.value}%` : formatCents(discount.value, locale, currency)
}

/**
 * Máscara de moeda durante a digitação: os dígitos são centavos ("2500" → 2500 → "25,00"). Assim
 * o campo nunca aceita letra nem vírgula fora do lugar.
 */
export function parseCentsInput(raw: string): number | null {
  const digits = raw
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 11)
  return digits === '' ? null : Number(digits)
}

export function formatCentsInput(cents: number | null): string {
  if (cents === null) return ''
  const value = String(cents).padStart(3, '0')
  const integer = value.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integer},${value.slice(-2)}`
}

export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

/** ISO → `YYYY-MM-DDTHH:mm` no fuso do navegador (o que o `datetime-local` espera). */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** `5511987654321` → `+55 (11) 98765-4321`. Outro formato sai como veio. */
export function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const match = /^(\d{2})(\d{2})(\d{4,5})(\d{4})$/.exec(phone)
  return match ? `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}` : phone
}

/** Máscara progressiva do telefone nacional enquanto digita. */
export function maskPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
