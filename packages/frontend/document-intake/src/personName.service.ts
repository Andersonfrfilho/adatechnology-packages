/* Copyright (c) 2026 Ada Technology. MIT License. */

/** Partículas que ficam minúsculas no meio do nome (`Maria da Silva`), nunca na primeira palavra. */
export const PERSON_NAME_PARTICLES: ReadonlySet<string> = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

const LOCALE = 'pt-BR'
const WORD_SEPARATORS = /(['’-])/u

function capitalize(word: string): string {
  const [first = '', ...rest] = [...word.toLocaleLowerCase(LOCALE)]
  return first.toLocaleUpperCase(LOCALE) + rest.join('')
}

/** `d'ávila` → `D'Ávila`, `maria-clara` → `Maria-Clara`: cada trecho entre apóstrofo ou hífen abre com maiúscula. */
function capitalizeWord(word: string): string {
  return word
    .split(WORD_SEPARATORS)
    .map((part) => (WORD_SEPARATORS.test(part) ? part : capitalize(part)))
    .join('')
}

/**
 * Nome de pessoa para gravar: apara e colapsa espaços (inclusive NBSP), caixa de título por palavra, partículas
 * `da de do das dos e` em minúscula (menos na primeira palavra) e apóstrofo/hífen tratados (`D'Ávila`, `Ana-Maria`).
 * `JOSÉ DA SILVA` e `josé da silva` viram `José da Silva`.
 */
export function normalizePersonName(value: string): string {
  const words = value.trim().split(/\s+/u).filter(Boolean)
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase(LOCALE)
      return index > 0 && PERSON_NAME_PARTICLES.has(lower) ? lower : capitalizeWord(word)
    })
    .join(' ')
}
