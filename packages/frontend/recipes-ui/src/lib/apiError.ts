/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lê o erro que o cliente HTTP do host lançou. Aceita a forma do `module-http`
 * (`{ code, message, details }`) direto no erro ou em `body.error`.
 */

type ErrorShape = {
  readonly code?: string
  readonly message?: string
  readonly details?: Readonly<Record<string, unknown>>
}

function readShape(error: unknown): ErrorShape {
  if (typeof error !== 'object' || error === null) return {}
  const candidate = error as ErrorShape & { body?: { error?: ErrorShape }; publicDetails?: ErrorShape['details'] }
  if (candidate.body?.error) return candidate.body.error
  return { ...candidate, ...(candidate.publicDetails ? { details: candidate.publicDetails } : {}) }
}

export function readErrorCode(error: unknown): string | undefined {
  return readShape(error).code
}

export function readErrorDetails(error: unknown): Readonly<Record<string, unknown>> {
  return readShape(error).details ?? {}
}
