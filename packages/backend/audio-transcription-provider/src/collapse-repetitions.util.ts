/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rede de segurança para o loop de n-grama do Whisper.
 *
 * Quando o trecho tem silêncio, ruído de fundo ou fala sobreposta, o decoder perde o sinal e passa
 * a repetir a última frase até esgotar a janela — o áudio de dois minutos vira "de coletivo, de
 * coletivo, de coletivo" noventa vezes. Isso não é bug de um engine específico: acontece no Groq,
 * no whisper.cpp e no navegador, porque é o modelo. As mitigações de decodificação (`--max-context`
 * no local, penalidade de repetição onde há acesso à geração) reduzem a frequência e não eliminam
 * o caso, e o que sobra chega inteiro ao usuário.
 *
 * Por isso o colapso é feito no texto, depois, onde vale para qualquer engine: fala humana repete
 * palavra e repete frase, mas não repete o mesmo ciclo de segmentos três vezes seguidas.
 */

/** Ciclos maiores que isto são discurso, não loop — repetir oito orações idênticas é conteúdo. */
const MAX_CYCLE_SEGMENTS = 8

/** Duas repetições ainda são ênfase legítima ("não, não, não"). A partir da terceira é o modelo travando. */
const MIN_OCCURRENCES_TO_COLLAPSE = 3

const SEGMENT_SPLIT = /([.!?…,;]+\s*)/

type Segment = Readonly<{
  /** Texto original com a pontuação que o seguia — é o que volta para o usuário. */
  raw: string
  /** Forma normalizada usada só na comparação, para "Nós vamos lá," casar com "nós vamos lá". */
  key: string
}>

type Cycle = Readonly<{ length: number; occurrences: number }>

export function collapseRepetitions(text: string): string {
  const segments = splitIntoSegments(text)
  const kept: Segment[] = []

  let index = 0
  while (index < segments.length) {
    const cycle = findRepeatedCycle(segments, index)
    if (!cycle) {
      kept.push(segments[index] as Segment)
      index++
      continue
    }

    for (let offset = 0; offset < cycle.length; offset++) kept.push(segments[index + offset] as Segment)
    index += cycle.length * cycle.occurrences
  }

  return kept
    .map((segment) => segment.raw)
    .join('')
    .trim()
}

function splitIntoSegments(text: string): readonly Segment[] {
  const parts = text.split(SEGMENT_SPLIT)
  const segments: Segment[] = []

  for (let index = 0; index < parts.length; index += 2) {
    const body = parts[index]
    if (!body?.trim()) continue
    segments.push(Object.freeze({ raw: body + (parts[index + 1] ?? ''), key: normalize(body) }))
  }

  return segments
}

function normalize(body: string): string {
  return body
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Procura o **menor** ciclo que se repete a partir de `start`, para que "a, b, a, b, a, b" colapse
 * em "a, b" e não em "a, b, a, b" — o ciclo maior também casa, e devolver ele deixaria metade do
 * loop no texto.
 */
function findRepeatedCycle(segments: readonly Segment[], start: number): Cycle | undefined {
  for (let length = 1; length <= MAX_CYCLE_SEGMENTS; length++) {
    const occurrences = countOccurrences(segments, start, length)
    if (occurrences >= MIN_OCCURRENCES_TO_COLLAPSE) return Object.freeze({ length, occurrences })
  }

  return undefined
}

function countOccurrences(segments: readonly Segment[], start: number, length: number): number {
  let occurrences = 1

  while (matchesCycle(segments, start, length, occurrences)) occurrences++

  return occurrences
}

function matchesCycle(segments: readonly Segment[], start: number, length: number, occurrence: number): boolean {
  const base = start + length * occurrence
  if (base + length > segments.length) return false

  for (let offset = 0; offset < length; offset++) {
    if (segments[start + offset]?.key !== segments[base + offset]?.key) return false
  }

  return true
}
