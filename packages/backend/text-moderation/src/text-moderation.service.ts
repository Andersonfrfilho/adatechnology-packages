/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Detecção de linguagem ofensiva para produtos conversacionais pt-BR.
 *
 * `wholeWord` é a decisão que importa aqui. Casar por substring — o que uma blocklist caseira faz
 * naturalmente com `includes` — rejeita "Paulo" por conter `pau`, "Ana Cunha" e "Marcus" por
 * conterem `cu`, "Rolando" por `rola`. Paulo e Paula estão entre os nomes mais comuns do Brasil e
 * Cunha entre os sobrenomes, então o filtro ingênuo barra cliente legítimo em silêncio.
 */

import { Profanity, ProfanityOptions, profaneWords } from '@2toad/profanity'

import { BASE_DICTIONARY_LANGUAGE, PT_BR_OFFENSIVE_TERMS, TERM_LIST_SEPARATOR } from './text-moderation.constant'
import type { TextModerationConfig, TextModerationVerdict, TextModerator } from './text-moderation.types'

const CLEAN_VERDICT: TextModerationVerdict = Object.freeze({ isOffensive: false, matchedTerms: Object.freeze([]) })

// Quebra em palavras respeitando acento e hífen: `\p{L}` mantém "José" e "desgraça" inteiros, onde
// `\w` cortaria no acento e produziria pedaços que nunca casam com o dicionário.
const WORD_PATTERN = /[\p{L}'-]+/gu

/**
 * Lê uma lista vinda de variável de ambiente (`"a,b,c"`).
 *
 * Fica no pacote só para os produtos não reimplementarem o split; quem lê `process.env` continua
 * sendo o módulo de configuração de cada produto.
 */
export function parseTermList(value: string | undefined): readonly string[] {
  if (!value) return []

  return value
    .split(TERM_LIST_SEPARATOR)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0)
}

export function createTextModerator(config: TextModerationConfig): TextModerator {
  if (!config.isEnabled) {
    return Object.freeze({
      inspect: () => CLEAN_VERDICT,
      censor: (text: string) => text,
    })
  }

  const filter = new Profanity(
    new ProfanityOptions({
      languages: [BASE_DICTIONARY_LANGUAGE],
      wholeWord: true,
      // Sem isto a fronteira de palavra é ASCII e "desgraça" ou "otário" escapam pelo acento.
      unicodeWordBoundaries: true,
    }),
  )

  filter.removeWords([...(profaneWords.get(BASE_DICTIONARY_LANGUAGE) ?? [])])
  filter.addWords([...PT_BR_OFFENSIVE_TERMS, ...(config.extraTerms ?? [])])

  const allowed = config.allowedTerms ?? []
  if (allowed.length > 0) filter.whitelist.addWords([...allowed])

  function inspect(text: string): TextModerationVerdict {
    if (!filter.exists(text)) return CLEAN_VERDICT

    // Termo a termo em vez de fatiar o texto censurado: frase ofensiva ("vai tomar no cu") tem o
    // núcleo no dicionário, então a varredura por palavra a pega sem depender de alinhar tokens
    // entre original e censurado.
    const words = text.match(WORD_PATTERN) ?? []
    const matchedTerms = [...new Set(words.filter((word) => filter.exists(word)).map((word) => word.toLowerCase()))]

    return Object.freeze({ isOffensive: true, matchedTerms: Object.freeze(matchedTerms) })
  }

  return Object.freeze({
    inspect,
    censor: (text: string) => filter.censor(text),
  })
}
