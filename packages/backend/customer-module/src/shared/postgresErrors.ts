/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reconhece a violação de unicidade pelo CÓDIGO do Postgres, e não pelo texto da mensagem: o texto
 * muda com a localização do servidor, e um `includes('duplicate key')` deixa de casar num banco em
 * outra língua sem que nada avise.
 */

const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false

  // O driver embrulha o erro do Postgres; o original vem em `cause`.
  const candidates = [error, (error as { cause?: unknown }).cause]

  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false
    const { code, constraint: name } = candidate as { code?: string; constraint?: string }
    if (code !== UNIQUE_VIOLATION) return false
    return constraint === undefined || name === constraint
  })
}

export const CUSTOMER_CONSTRAINT = {
  WHATSAPP_PHONE: 'idx_customer_phones_whatsapp',
} as const
