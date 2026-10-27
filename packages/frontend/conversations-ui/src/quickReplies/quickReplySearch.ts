import { applyQuickReplyVariables } from '../MessageComposer'
import type { QuickReply } from './quickReply.types'

const DIACRITIC_PATTERN = /[\u0300-\u036f]/g

export type NormalizedIndexMap = {
  readonly normalized: string
  /** `normalized[i]` veio do caractere original que começa em `originalIndexOf[i]` (UTF-16). */
  readonly originalIndexOf: readonly number[]
}

/**
 * Normaliza caractere a caractere (não a string inteira) e guarda, para cada posição do resultado,
 * de qual índice do texto original ela veio. Um caractere de entrada não produz sempre um único
 * caractere de saída: `'İ'.toLowerCase()` vira dois (`'i̇'`), e um acento em NFD normaliza para uma
 * base sem o combinante. Sem o mapa, `highlightMatch` recorta o texto original no índice errado
 * assim que a entrada tem um desses casos — foi o que quebrava com "José" em NFD e com maiúscula
 * que cresce ao virar minúscula.
 */
export function normalizeForSearchWithMap(value: string): NormalizedIndexMap {
  let normalized = ''
  const originalIndexOf: number[] = []
  let originalCursor = 0
  for (const char of value) {
    const piece = char.normalize('NFD').replace(DIACRITIC_PATTERN, '').toLowerCase()
    for (let i = 0; i < piece.length; i++) originalIndexOf.push(originalCursor)
    normalized += piece
    originalCursor += char.length
  }
  return { normalized, originalIndexOf }
}

export function normalizeForSearch(value: string): string {
  return normalizeForSearchWithMap(value).normalized
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
  // Termo composto só de marcas combinantes (ex.: "́" sozinho) normaliza para string vazia —
  // tratar como termo vazio, senão `indexOf('')` em `highlightMatch` casaria em todo índice.
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
  const { normalized: normalizedText, originalIndexOf } = normalizeForSearchWithMap(text)
  const normalizedTerm = normalizeForSearch(term)
  // Termo só de marcas combinantes (ex.: "́") normaliza para "" — `indexOf('')` sempre acha
  // posição 0 e o laço abaixo nunca avança o cursor, travando a aba num loop infinito.
  if (!normalizedTerm) return [{ text, isMatch: false }]
  // Índice original correspondente a uma posição do texto normalizado — o comprimento do texto
  // original fecha o mapa para quando a posição cai depois do último caractere normalizado.
  const originalIndexAt = (normalizedIndex: number): number =>
    normalizedIndex < originalIndexOf.length ? originalIndexOf[normalizedIndex]! : text.length

  const segments: MatchSegment[] = []
  let normalizedCursor = 0
  let originalCursor = 0
  while (normalizedCursor < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedTerm, normalizedCursor)
    if (matchIndex === -1) break
    const matchOriginalStart = originalIndexAt(matchIndex)
    if (matchOriginalStart > originalCursor) {
      segments.push({ text: text.slice(originalCursor, matchOriginalStart), isMatch: false })
    }
    const matchNormalizedEnd = matchIndex + normalizedTerm.length
    const matchOriginalEnd = originalIndexAt(matchNormalizedEnd)
    segments.push({ text: text.slice(matchOriginalStart, matchOriginalEnd), isMatch: true })
    normalizedCursor = matchNormalizedEnd
    originalCursor = matchOriginalEnd
  }
  if (originalCursor < text.length) segments.push({ text: text.slice(originalCursor), isMatch: false })
  return segments
}
