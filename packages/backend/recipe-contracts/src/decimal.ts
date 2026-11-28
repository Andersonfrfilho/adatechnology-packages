/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Aritmética exata para quantidade e dinheiro: nada de ponto flutuante. O valor vive como fração
 * de `bigint` e só vira texto (com arredondamento explícito) na saída.
 */

export type Rational = { readonly numerator: bigint; readonly denominator: bigint }

/** Até 10 dígitos inteiros e 4 casas: o mesmo `numeric(14,4)` das colunas do módulo. */
export const DECIMAL_PATTERN = /^\d{1,10}(\.\d{1,4})?$/
export const DECIMAL_SCALE = 4

export const ZERO: Rational = { numerator: 0n, denominator: 1n }
export const ONE: Rational = { numerator: 1n, denominator: 1n }

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let first = absolute(left)
  let second = absolute(right)
  while (second !== 0n) [first, second] = [second, first % second]
  return first === 0n ? 1n : first
}

export function rational(numerator: bigint, denominator: bigint = 1n): Rational {
  if (denominator === 0n) throw new RangeError('denominador zero')
  const sign = denominator < 0n ? -1n : 1n
  const divisor = greatestCommonDivisor(numerator, denominator)
  return { numerator: (sign * numerator) / divisor, denominator: absolute(denominator) / divisor }
}

export function isDecimalText(text: string): boolean {
  return DECIMAL_PATTERN.test(text)
}

/** Aceita só o formato de `DECIMAL_PATTERN` (ou o que o Postgres devolve, `-` e mais casas). */
export function parseDecimal(text: string): Rational {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.trim())
  if (!match) throw new RangeError(`decimal inválido: ${text}`)
  const fraction = match[3] ?? ''
  const digits = BigInt(`${match[2]}${fraction}`)
  return rational(match[1] === '-' ? -digits : digits, 10n ** BigInt(fraction.length))
}

export function fromInteger(value: number): Rational {
  if (!Number.isSafeInteger(value)) throw new RangeError(`inteiro inválido: ${value}`)
  return rational(BigInt(value))
}

export function fromCents(cents: number): Rational {
  return rational(fromInteger(cents).numerator, 100n)
}

export function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

export function subtract(left: Rational, right: Rational): Rational {
  return add(left, { numerator: -right.numerator, denominator: right.denominator })
}

export function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator)
}

export function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new RangeError('divisão por zero')
  return rational(left.numerator * right.denominator, left.denominator * right.numerator)
}

export function compare(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator
  return difference === 0n ? 0 : difference < 0n ? -1 : 1
}

export function maximum(left: Rational, right: Rational): Rational {
  return compare(left, right) >= 0 ? left : right
}

export function isPositive(value: Rational): boolean {
  return value.numerator > 0n
}

export const ROUNDING = { HALF_UP: 'half-up', UP: 'up', DOWN: 'down' } as const
export type Rounding = (typeof ROUNDING)[keyof typeof ROUNDING]

/** Inteiro mais próximo; meio sobe para longe do zero. `up` arredonda para longe do zero. */
function roundToInteger(value: Rational, rounding: Rounding): bigint {
  const sign = value.numerator < 0n ? -1n : 1n
  const magnitude = absolute(value.numerator)
  const quotient = magnitude / value.denominator
  const remainder = magnitude % value.denominator
  if (remainder === 0n || rounding === ROUNDING.DOWN) return sign * quotient
  if (rounding === ROUNDING.UP) return sign * (quotient + 1n)
  return sign * (remainder * 2n >= value.denominator ? quotient + 1n : quotient)
}

export function roundToScale(value: Rational, scale: number, rounding: Rounding = ROUNDING.HALF_UP): Rational {
  const factor = 10n ** BigInt(scale)
  return rational(roundToInteger(multiply(value, rational(factor)), rounding), factor)
}

export function formatDecimal(
  value: Rational,
  scale: number = DECIMAL_SCALE,
  rounding: Rounding = ROUNDING.HALF_UP,
): string {
  const factor = 10n ** BigInt(scale)
  const scaled = roundToInteger(multiply(value, rational(factor)), rounding)
  const sign = scaled < 0n ? '-' : ''
  const digits = absolute(scaled)
    .toString()
    .padStart(scale + 1, '0')
  if (scale === 0) return `${sign}${digits}`
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

/** Reais (fração) → centavos inteiros. */
export function toCents(value: Rational, rounding: Rounding = ROUNDING.HALF_UP): number {
  return Number(roundToInteger(multiply(value, rational(100n)), rounding))
}

/** Texto do banco ou do formulário → forma canônica de 4 casas (`"2.5"` → `"2.5000"`). */
export function normalizeDecimal(text: string): string {
  return formatDecimal(parseDecimal(text))
}
