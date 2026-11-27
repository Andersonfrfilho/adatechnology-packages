/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const TAG_MAX_LENGTH = 40
export const TAGS_MAX_COUNT = 20

/**
 * Tag vira filtro de URL (`?tag=`), então guarda-se uma forma só: minúscula, sem espaço sobrando.
 * "Novidades" e "novidades " seriam duas tags no filtro e uma só na cabeça de quem escreve.
 */
export function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, TAG_MAX_LENGTH)
}

/** Normaliza, remove vazias e repetidas, preserva a ordem em que o autor digitou. */
export function normalizeTags(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const tag = normalizeTag(value)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    result.push(tag)
  }
  return result.slice(0, TAGS_MAX_COUNT)
}

export type TagLabels = Readonly<Record<string, string>>

/**
 * Rótulo de exibição por tag: a tag guarda a forma de URL ("cardápio"), o rótulo guarda como o autor
 * escreveu ("Cardápio"). Só entra no mapa o que difere da tag; o resto cai no rótulo padrão da UI.
 * `explicit` vence o texto digitado; `previous` mantém o rótulo de tag que continua no post.
 */
export function buildTagLabels(params: {
  readonly typed: readonly string[]
  readonly explicit?: TagLabels | undefined
  readonly previous?: TagLabels | undefined
}): TagLabels {
  const labels: Record<string, string> = {}
  for (const value of params.typed) {
    const tag = normalizeTag(value)
    if (!tag) continue
    const typed = value.trim().replace(/\s+/g, ' ').slice(0, TAG_MAX_LENGTH)
    const label = params.explicit?.[tag]?.trim() || (typed !== tag ? typed : undefined) || params.previous?.[tag]
    if (label && label !== tag) labels[tag] = label
  }
  return labels
}

/** Rótulo padrão sem rótulo guardado: primeira letra maiúscula e hífen vira espaço ("fim-de-ano" → "Fim de ano"). */
export function formatTagLabel(tag: string, labels?: TagLabels): string {
  const stored = labels?.[tag]
  if (stored) return stored
  const spaced = tag.replace(/-+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
