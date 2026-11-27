/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lê o erro que o cliente HTTP do host lançou. Aceita a forma do `module-http`
 * (`{ code, message, details: { fields, reasons } }`) direto no erro ou em `body.error`.
 */

import type { CouponRejection, FieldIssue } from '@adatechnology/coupon-contracts'

type ErrorShape = {
  readonly code?: string
  readonly message?: string
  readonly details?: { readonly fields?: readonly FieldIssue[]; readonly reasons?: readonly CouponRejection[] }
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

/** Campos recusados, sem repetir campo. */
export function readFieldIssues(error: unknown): FieldIssue[] {
  const seen = new Set<string>()
  return (readShape(error).details?.fields ?? []).filter((issue) => {
    if (seen.has(issue.field)) return false
    seen.add(issue.field)
    return true
  })
}

export function readRejections(error: unknown): CouponRejection[] {
  return [...(readShape(error).details?.reasons ?? [])]
}
