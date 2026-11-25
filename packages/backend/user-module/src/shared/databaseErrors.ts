/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

const UNIQUE_VIOLATION_CODE = '23505'
const MAX_CAUSE_DEPTH = 5

/** O driver pode embrulhar o erro do Postgres (`cause`); procura o código SQLSTATE na cadeia. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown }
    if (candidate.code === UNIQUE_VIOLATION_CODE) return true
    current = candidate.cause
  }
  return false
}
