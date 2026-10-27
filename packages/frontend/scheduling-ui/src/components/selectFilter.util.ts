/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Busca do `SelectField`. Fora do componente porque é a única parte dele que erra calada: um
 * recurso chamado "Salão Térreo" que não aparece ao digitar "salao terreo" parece lista vazia, não
 * defeito de acentuação.
 */

export type SelectOption = {
  readonly value: string
  readonly label: string
}

const COMBINING_MARKS = /[̀-ͯ]/g

/** Sem acento e sem caixa — quem digita no celular raramente acentua. */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim()
}

export function filterSelectOptions(options: readonly SelectOption[], query: string): readonly SelectOption[] {
  const needle = normalizeForSearch(query)
  if (needle === '') return options

  return options.filter((option) => normalizeForSearch(option.label).includes(needle))
}

/** Índice para onde o teclado salta ao digitar sem caixa de busca. `-1` quando nada casa. */
export function findByPrefix(options: readonly SelectOption[], prefix: string): number {
  const needle = normalizeForSearch(prefix)
  if (needle === '') return -1

  return options.findIndex((option) => normalizeForSearch(option.label).startsWith(needle))
}
