/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PhoneConfig } from '@adatechnology/user-contracts'

const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15

/** Padrão neutro: só dígitos, de 8 a 15. A regra de um país (DDI, nono dígito...) entra por `config.phone.normalize`. */
export function normalizePhone(params: {
  readonly raw: string
  readonly config: PhoneConfig | undefined
}): string | undefined {
  if (params.config?.normalize) return params.config.normalize(params.raw)
  const digits = params.raw.replace(/\D/g, '')
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS ? digits : undefined
}
