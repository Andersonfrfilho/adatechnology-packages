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
