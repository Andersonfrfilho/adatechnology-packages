/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Forma canônica do contato: é por ela que o lead é deduplicado. Telefone digitado com máscara,
 * espaço ou `+55` e o mesmo número sem nada disso são a mesma pessoa.
 */

export const DEFAULT_PHONE_COUNTRY_CODE = '55'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_MIN_DIGITS = 10
const PHONE_MAX_DIGITS = 15

/**
 * Só dígitos, com DDI. Número nacional (10 ou 11 dígitos) ganha o DDI padrão. `undefined` quando
 * não é telefone.
 */
export function canonicalPhone(raw: string, countryCode: string = DEFAULT_PHONE_COUNTRY_CODE): string | undefined {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return undefined
  // 10 ou 11 dígitos é sempre nacional (DDD 55 existe: não dá para adivinhar DDI pelo começo).
  return digits.length <= 11 ? `${countryCode}${digits}` : digits
}

/** Minúsculo e sem espaço nas pontas. `undefined` quando não parece e-mail. */
export function canonicalEmail(raw: string): string | undefined {
  const email = raw.trim().toLowerCase()
  return EMAIL_PATTERN.test(email) && email.length <= 254 ? email : undefined
}

/** `****1234`: o único jeito de um telefone aparecer num log. */
export function maskPhone(phone: string): string {
  return `****${phone.slice(-4)}`
}
