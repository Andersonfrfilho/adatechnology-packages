/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

const FOREIGN_KEY_VIOLATION = '23503'
const UNIQUE_VIOLATION = '23505'

// O driver embrulha o erro do Postgres em `cause` conforme a versão, e o Bun SQL põe o SQLSTATE em
// `errno` (o `code` dele é `ERR_POSTGRES_SERVER_ERROR`): procura os dois, alguns níveis abaixo.
function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as { code?: unknown; errno?: unknown }
    if (candidate.code === code || candidate.errno === code) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPostgresCode(error, FOREIGN_KEY_VIOLATION)
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPostgresCode(error, UNIQUE_VIOLATION)
}

/** `%` e `_` digitados na busca são literais, não curingas. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}
