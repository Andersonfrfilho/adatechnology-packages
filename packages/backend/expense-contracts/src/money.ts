/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dinheiro é texto com até duas casas (`numeric` do banco), nunca float. Toda conta é feita em centavos (`bigint`).
 */

const MONEY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/

/** `'1500.5'` → `150050n`; `null` quando não é valor não negativo com até 2 casas. */
export function parseMoneyToCents(value: string): bigint | null {
  const match = MONEY_PATTERN.exec(value.trim())
  if (match?.[1] === undefined) return null
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}

/** `150050n` → `'1500.50'`. Aceita negativo (lucro, diferença). */
export function formatCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = absolute / 100n
  const fraction = (absolute % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Normaliza para duas casas (`'10'` → `'10.00'`); `null` quando ilegível. */
export function normalizeMoney(value: string): string | null {
  const cents = parseMoneyToCents(value)
  return cents === null ? null : formatCents(cents)
}

/**
 * Valor vindo do banco com quatro casas (`numeric(19,4)`): aceito só quando as duas últimas são zero (`'10.5000'`).
 * Arredondar aqui faria a soma deixar de bater com o que foi digitado.
 */
export function parseStoredMoneyToCents(value: string): bigint | null {
  return parseMoneyToCents(value.trim().replace(/^(\d+\.\d{2})0{1,2}$/, '$1'))
}

/** Divisão de não negativos arredondada meio para cima (o arredondamento de dinheiro do módulo). */
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('divisão por zero')
  return (2n * numerator + denominator) / (2n * denominator)
}

/**
 * Divide `total` pelos pesos sem perder unidade: piso em cada parte e o resto inteiro para o de maior peso.
 * Determinístico no empate (o primeiro índice vence), para a mesma entrada dar sempre os mesmos números.
 */
export function distributeByWeight(total: bigint, weights: readonly bigint[]): bigint[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  if (totalWeight === 0n || total === 0n) return weights.map(() => 0n)

  const parts = weights.map((weight) => (total * weight) / totalWeight)
  const remainder = total - parts.reduce((sum, part) => sum + part, 0n)
  if (remainder === 0n) return parts

  let heaviest = 0
  weights.forEach((weight, index) => {
    if (weight > (weights[heaviest] ?? 0n)) heaviest = index
  })
  parts[heaviest] = (parts[heaviest] ?? 0n) + remainder

  return parts
}

/** `'1234.5'` → `'R$ 1.234,50'`. Negativo sai com sinal antes do símbolo. */
export function formatBrl(amount: string | bigint): string {
  const cents = typeof amount === 'bigint' ? amount : parseSignedMoneyToCents(amount)
  if (cents === null) throw new Error(`valor inválido: ${String(amount)}`)
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, '.')
  return `${negative ? '-' : ''}R$ ${whole},${(absolute % 100n).toString().padStart(2, '0')}`
}

function parseSignedMoneyToCents(value: string): bigint | null {
  const trimmed = value.trim()
  if (trimmed.startsWith('-')) {
    const cents = parseMoneyToCents(trimmed.slice(1))
    return cents === null ? null : -cents
  }
  return parseMoneyToCents(trimmed)
}

/** `yyyy-mm-dd` que existe no calendário. */
export function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

/** `yyyy-mm` válido. */
export function isCompetence(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/u.test(value)
}

/** Soma `days` dias a uma data civil `yyyy-mm-dd`. */
export function addCivilDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** O dia civil (`yyyy-mm-dd`) de um instante num fuso IANA (padrão `America/Sao_Paulo`). */
export function civilDateInTimeZone(instant: Date, timeZone = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(instant)
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/** A hora cheia (0–23) de um instante num fuso IANA. */
export function hourInTimeZone(instant: Date, timeZone = 'America/Sao_Paulo'): number {
  const hour = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(instant)
  return Number(hour) % 24
}
