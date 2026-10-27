/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/** Duck typing: o erro do cliente HTTP do host carrega `code`, e o pacote não conhece essa classe. */
export function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined

  return typeof error.code === 'string' ? error.code : undefined
}
