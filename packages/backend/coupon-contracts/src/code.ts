/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const COUPON_CODE_PATTERN = /^[A-Z0-9-]{3,32}$/
export const COUPON_CODE_MAX_LENGTH = 32
export const CODE_PREFIX_PATTERN = /^[A-Z0-9]{1,12}$/
export const GENERATED_CODE_LENGTH = 8
/** Sem 0/O nem 1/I: o código é lido em voz alta e digitado no celular. */
export const GENERATED_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Fonte de aleatoriedade: inteiro em `[0, max)`. O módulo injeta uma criptográfica. */
export type RandomIntSource = (max: number) => number

/** Maiúsculas e sem espaço: "  bem vindo10 " e "BEMVINDO10" são o mesmo cupom. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function isValidCouponCode(code: string): boolean {
  return COUPON_CODE_PATTERN.test(code)
}

export function normalizeCodePrefix(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function generateCouponCode(params: {
  readonly prefix?: string | null
  readonly randomInt: RandomIntSource
}): string {
  const body = Array.from(
    { length: GENERATED_CODE_LENGTH },
    () => GENERATED_CODE_ALPHABET[params.randomInt(GENERATED_CODE_ALPHABET.length)],
  ).join('')
  return params.prefix ? `${params.prefix}-${body}` : body
}

/** Criptográfica e sem viés de módulo; usa `crypto.getRandomValues` (Bun, Node 19+, navegador). */
export function cryptoRandomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buffer)
    const value = buffer[0] ?? 0
    if (value < limit) return value % max
  }
}
