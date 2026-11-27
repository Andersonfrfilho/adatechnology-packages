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

export function formatDateTime(iso: string | null, locale: string, timeZone?: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso))
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Hora de parede (`YYYY-MM-DDTHH:mm`) do instante no fuso dado; sem fuso, o do navegador. */
export function toDateTimeLocalValue(iso: string | null, timeZone?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (!timeZone)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * Hora de parede no fuso da empresa → instante ISO. O painel pode estar em outro fuso que a empresa:
 * "termina 31/12 23:59" é 23:59 de lá, não do computador de quem edita.
 */
export function fromDateTimeLocalValue(value: string, timeZone?: string): string | null {
  const match = WALL_TIME_PATTERN.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number]
  if (!timeZone) {
    const local = new Date(year, month - 1, day, hour, minute)
    return Number.isNaN(local.getTime()) ? null : local.toISOString()
  }
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let guess = wallAsUtc
  // Duas voltas acertam o deslocamento mesmo perto da troca de horário de verão.
  for (let round = 0; round < 2; round += 1) {
    const shown = fromWallString(toDateTimeLocalValue(new Date(guess).toISOString(), timeZone))
    guess += wallAsUtc - shown
  }
  return new Date(guess).toISOString()
}

function fromWallString(value: string): number {
  const [year, month, day, hour, minute] = (WALL_TIME_PATTERN.exec(value) ?? []).slice(1).map(Number) as number[]
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
}

/** `31/12/2026` + `23:59` → `2026-12-31T23:59`; incompleto ou inválido → `''`. */
export function joinDateTimeParts(date: string, time: string): string {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) return ''
  const [day, month, year] = dateMatch.slice(1).map(Number) as [number, number, number]
  const [hour, minute] = timeMatch.slice(1).map(Number) as [number, number]
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day || hour > 23 || minute > 59) return ''
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

export function splitDateTimeValue(value: string): { date: string; time: string } {
  const match = WALL_TIME_PATTERN.exec(value)
  if (!match) return { date: '', time: '' }
  return { date: `${match[3]}/${match[2]}/${match[1]}`, time: `${match[4]}:${match[5]}` }
}

export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`
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

/** `31/12/2026` → `2026-12-31`; incompleto ou inválido → `''`. */
export function parseDateInput(date: string): string {
  return joinDateTimeParts(date, '00:00').slice(0, 10)
}

export function formatDateInput(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

/**
 * Dias inteiros no fuso da empresa → limites meio abertos em instantes: `from` = 00:00 do primeiro
 * dia; `to` = 00:00 do dia SEGUINTE ao último (o último dia entra inteiro).
 */
export function dayRangeToInstants(
  range: { readonly from: string; readonly to: string },
  timeZone?: string,
): { from?: string; to?: string } {
  const result: { from?: string; to?: string } = {}
  const from = range.from ? fromDateTimeLocalValue(`${range.from}T00:00`, timeZone) : null
  if (from) result.from = from
  if (range.to) {
    const [year, month, day] = range.to.split('-').map(Number) as [number, number, number]
    const next = new Date(Date.UTC(year, month - 1, day + 1))
    const nextDay = next.toISOString().slice(0, 10)
    const to = fromDateTimeLocalValue(`${nextDay}T00:00`, timeZone)
    if (to) result.to = to
  }
  return result
}
