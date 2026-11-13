/**
 * Copyright (c) 2026 Ada Technology.
 * Licensed under the MIT License.
 */

/** Escapa texto livre antes de entrar no XML fiscal — um & solto invalida o documento e a assinatura */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
