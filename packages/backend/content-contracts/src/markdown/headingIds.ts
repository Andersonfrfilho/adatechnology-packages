/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { slugify } from '../slugify'

/**
 * Gera âncoras estáveis para títulos (`#como-funciona`), com sufixo para repetidos. Compartilhado
 * pelos dois renderizadores para o link de âncora ser o mesmo no HTML do servidor e no React.
 */
export function createHeadingIdGenerator(prefix = ''): (text: string) => string {
  const used = new Map<string, number>()
  return (text: string) => {
    const base = slugify(text) || 'section'
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return `${prefix}${count === 1 ? base : `${base}-${count}`}`
  }
}
