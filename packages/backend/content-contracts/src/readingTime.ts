/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { markdownToPlainText } from './markdown/plainText'

/** Média de leitura silenciosa de texto corrido em português e inglês. */
export const DEFAULT_WORDS_PER_MINUTE = 200

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
}

/** Minutos de leitura, sempre ao menos 1: "0 min de leitura" num post curto soa como erro. */
export function estimateReadingTimeMinutes(markdown: string, wordsPerMinute = DEFAULT_WORDS_PER_MINUTE): number {
  const words = countWords(markdownToPlainText(markdown))
  return Math.max(1, Math.ceil(words / Math.max(1, wordsPerMinute)))
}

/**
 * Resumo a partir do corpo, para quando o autor não escreveu um. Corta em fronteira de palavra:
 * "promoção válida at…" no card parece defeito.
 */
export function buildExcerpt(markdown: string, maxLength = 200): string {
  const text = markdownToPlainText(markdown).replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}
