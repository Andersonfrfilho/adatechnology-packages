/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ParseCachedJsonParams } from '@adatechnology/infra-contracts'

/** Cache e entrada nao confiavel: JSON quebrado ou de forma antiga e miss, nunca excecao. */
export function parseCachedJson<TData>(params: ParseCachedJsonParams<TData>): TData | undefined {
  let value: unknown
  try {
    value = JSON.parse(params.raw)
  } catch {
    return undefined
  }
  const parsed = params.schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}
