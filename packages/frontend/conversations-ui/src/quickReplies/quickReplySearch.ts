import { applyQuickReplyVariables } from '../MessageComposer'
import type { QuickReply } from './quickReply.types'

const DIACRITIC_PATTERN = /[\u0300-\u036f]/g

/**
 * Normaliza caractere a caractere (não a string inteira) para que o índice do resultado continue
 * batendo com o índice do texto original — é o que `highlightMatch` precisa para recortar sem
 * atropelar acento.
 */
export function normalizeForSearch(value: string): string {
  return Array.from(value)
    .map((char) => char.normalize('NFD').replace(DIACRITIC_PATTERN, '').toLowerCase())
    .join('')
}

export type FilterQuickRepliesParams = {
  readonly quickReplies: readonly QuickReply[]
  readonly search: string
  /** Resolve `{{marcador}}` antes de comparar — buscar "joão" deve achar quem cita o nome no corpo. */
  readonly variables?: Readonly<Record<string, string>>
}

/** Busca por título, atalho e corpo (com as variáveis já aplicadas). Termo vazio devolve tudo. */
export function filterQuickReplies({
  quickReplies,
  search,
  variables,
}: FilterQuickRepliesParams): readonly QuickReply[] {
  const term = normalizeForSearch(search.trim())
  if (!term) return quickReplies
  return quickReplies.filter((quickReply) => {
    const body = applyQuickReplyVariables(quickReply.body, variables)
    return (
      normalizeForSearch(quickReply.title).includes(term) ||
      normalizeForSearch(quickReply.shortcut).includes(term) ||
      normalizeForSearch(body).includes(term)
    )
  })
}

export type MatchSegment = {
  readonly text: string
  readonly isMatch: boolean
}

/**
 * Segmenta o texto ao redor do termo buscado para o chamador destacar sem HTML — quem cadastrou a
 * mensagem não deve conseguir injetar marcação pelo próprio corpo ou título.
 */
export function highlightMatch(text: string, search: string): readonly MatchSegment[] {
  const term = search.trim()
  if (!term) return [{ text, isMatch: false }]
  const normalizedText = normalizeForSearch(text)
  const normalizedTerm = normalizeForSearch(term)
  const segments: MatchSegment[] = []
  let cursor = 0
  while (cursor < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedTerm, cursor)
    if (matchIndex === -1) {
      segments.push({ text: text.slice(cursor), isMatch: false })
      break
    }
    if (matchIndex > cursor) segments.push({ text: text.slice(cursor, matchIndex), isMatch: false })
    const matchEnd = matchIndex + normalizedTerm.length
    segments.push({ text: text.slice(matchIndex, matchEnd), isMatch: true })
    cursor = matchEnd
  }
  return segments
}
