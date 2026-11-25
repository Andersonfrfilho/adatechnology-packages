/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

const UNIQUE_VIOLATION = '23505'

/**
 * Cada driver embrulha o erro do Postgres de um jeito (`code` direto, ou em `cause`). A checagem
 * prévia de slug não fecha a corrida entre dois saves simultâneos; o índice único fecha, e isto
 * traduz a violação para o 409 do domínio.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}
