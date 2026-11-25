/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const SLUG_MAX_LENGTH = 120

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Título para endereço: "Promoção de Verão!" → "promocao-de-verao". Acento sai pela decomposição
 * Unicode (NFD) em vez de tabela fixa, então funciona para qualquer idioma latino, não só pt-BR.
 * Pode devolver string vazia (título só de emoji ou ideogramas): o chamador decide o substituto.
 */
export function slugify(value: string): string {
  const base = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (base.length <= SLUG_MAX_LENGTH) return base

  // Corta na última fronteira de palavra para não deixar "promocao-de-ver" no endereço.
  const truncated = base.slice(0, SLUG_MAX_LENGTH)
  const lastHyphen = truncated.lastIndexOf('-')
  return (lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated).replace(/-+$/g, '')
}

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value)
}

/** `promocao` → `promocao-2` → `promocao-3`. Respeita o teto de tamanho mesmo com o sufixo. */
export function withSlugSuffix(slug: string, attempt: number): string {
  if (attempt <= 1) return slug
  const suffix = `-${attempt}`
  return `${slug.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`
}
