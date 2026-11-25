import { normalizeFlowText } from '@adatechnology/meta-whatsapp-contracts'
import type { FlowGlobalKeyword, FlowGlobalKeywordTarget } from './flowRunner.types'

/**
 * Destino da palavra global que a mensagem aciona. `exact` casa a mensagem inteira; `word` casa a
 * palavra (ou frase) inteira dentro da mensagem, nunca um pedaço de palavra. A palavra mais longa
 * vence e, em empate, a primeira da configuração.
 */
export function matchGlobalKeyword(
  text: string,
  entries: readonly FlowGlobalKeyword[],
): FlowGlobalKeywordTarget | undefined {
  const normalized = normalizeFlowText(text)
  if (normalized.length === 0) return undefined
  const padded = ` ${normalized} `

  let best: { length: number; target: FlowGlobalKeywordTarget } | undefined
  for (const entry of entries) {
    const isWordMatch = entry.match === 'word'
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeFlowText(keyword)
      if (normalizedKeyword.length === 0) continue
      const isMatch = isWordMatch ? padded.includes(` ${normalizedKeyword} `) : normalizedKeyword === normalized
      if (isMatch && (!best || normalizedKeyword.length > best.length)) {
        best = { length: normalizedKeyword.length, target: entry.target }
      }
    }
  }
  return best?.target
}
