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

/** Padrão do slug automático: curto o bastante para um link legível em qualquer rede. */
export const DEFAULT_SHORT_SLUG_LENGTH = 60

/** Artigos, preposições e conjunções do pt-BR que só alongam o endereço. */
export const PT_BR_STOP_WORDS: readonly string[] = [
  'a',
  'as',
  'o',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'e',
  'ou',
  'para',
  'pra',
  'pro',
  'por',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'com',
  'sem',
  'ao',
  'aos',
  'que',
  'se',
]

export type ShortSlugOptions = {
  /** Padrão: 60. */
  readonly maxLength?: number
  /** Padrão: pt-BR. `false` mantém todas as palavras. */
  readonly stopWords?: readonly string[] | false
}

/**
 * Slug automático curto: sem acento, sem palavra de ligação, cortado na fronteira de palavra dentro
 * de `maxLength`. "Novidades de fim de ano: cardápio para as festas" → "novidades-fim-ano-cardapio-festas".
 * Título só de palavras de ligação mantém as palavras (melhor longo que vazio).
 */
export function buildShortSlug(title: string, options: ShortSlugOptions = {}): string {
  const maxLength = Math.min(options.maxLength ?? DEFAULT_SHORT_SLUG_LENGTH, SLUG_MAX_LENGTH)
  const words = slugify(title).split('-').filter(Boolean)
  const stop = new Set(options.stopWords === false ? [] : (options.stopWords ?? PT_BR_STOP_WORDS))
  const meaningful = words.filter((word) => !stop.has(word))
  const kept = meaningful.length > 0 ? meaningful : words
  let slug = ''
  for (const word of kept) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > maxLength) break
    slug = next
  }
  return slug || (kept[0] ?? '').slice(0, maxLength).replace(/-+$/g, '')
}
