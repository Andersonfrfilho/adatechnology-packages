/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { createSupportMap } from '../../src/cargo-placement.policy.js'

/**
 * Spec 146 D1: **a vizinha escora a face quando cobre pelo menos 80% da borda** (`MIN_BRACED_EDGE_FRACTION`).
 * Antes era a borda inteira: bastava um trecho sem vizinha à altura para o lado inteiro contar como solto.
 *
 * O baú é o da conferência do bloco por entrega: `x` corre entre as laterais, `y` da cabeceira (`y = 0`) à
 * porta (`lineEnd`). A candidata é um cubo de 30 cm pousado a 0,90 m sobre a própria base — o topo a 1,20 m
 * passa de três vezes a base, e a contenção vai até 0,30 m. A cabeceira fica a 30 cm, além do giro da pilha
 * (`3b/√10` = 28,5 cm): parede ali não escora, só a vizinha.
 *
 * - D3: borda de até quatro células de 5 cm (menos de 25 cm) continua exigindo a borda inteira.
 * - A porta nunca ganha fração: do lado dela, só a borda inteira coberta conta, como antes.
 * - Só no baú fechado (`enclosedBody`); sem ele os quatro lados seguem exigindo a borda inteira.
 */
const BED = { heightM: 2, lengthM: 1.2, widthM: 2 }
const CUBE = { depthM: 0.3, heightM: 0.3, widthM: 0.3 }
const BASE = { depthM: 0.3, heightM: 0.9, widthM: 0.3 }
const CANDIDATE_Y_M = 0.3
const CANDIDATE_BASE_M = 0.9
const RESTRAINT_M = 0.3

type Neighbour = Readonly<{ depthM: number; widthM: number; xM: number; yM: number }>

/** O mapa com a base da candidata e as vizinhas altas (1 m) já carimbadas. */
function mapWith(neighbours: readonly Neighbour[], candidateXM = 0): ReturnType<typeof createSupportMap> {
  const support = createSupportMap(BED, 'lineEnd')
  support.stamp({ slot: BASE, topM: BASE.heightM, xM: candidateXM, yM: CANDIDATE_Y_M })
  for (const { depthM, widthM, xM, yM } of neighbours) {
    support.stamp({ slot: { depthM, heightM: 1, widthM }, topM: 1, xM, yM })
  }

  return support
}

function isConfined(
  support: ReturnType<typeof createSupportMap>,
  input: Readonly<{ enclosed: boolean; slot?: typeof CUBE; xM?: number }>,
): boolean {
  return support.isConfined({
    baseM: CANDIDATE_BASE_M,
    enclosed: input.enclosed,
    slot: input.slot ?? CUBE,
    topM: RESTRAINT_M,
    xM: input.xM ?? 0,
    yM: CANDIDATE_Y_M,
  })
}

/** Vizinha do lado da cabeceira, encostada na lateral `x = 0`, cobrindo `coveredM` da borda de 30 cm. */
function headboardNeighbour(coveredM: number): Neighbour {
  return { depthM: coveredM, widthM: CANDIDATE_Y_M, xM: 0, yM: 0 }
}

describe('a vizinha escora com 80% da borda (spec 146 D1)', () => {
  test('baú fechado: vizinha no sentido da cabeceira cobrindo 80% da borda + lateral de parede — escorada', () => {
    expect(isConfined(mapWith([headboardNeighbour(0.24)]), { enclosed: true })).toBe(true)
  })

  test('baú fechado: a mesma vizinha cobrindo 1 cm a menos (77%) — solta', () => {
    expect(isConfined(mapWith([headboardNeighbour(0.23)]), { enclosed: true })).toBe(false)
  })

  test('baú fechado: a borda inteira coberta continua escorando', () => {
    expect(isConfined(mapWith([headboardNeighbour(0.3)]), { enclosed: true })).toBe(true)
  })

  test('D3: borda de 20 cm (quatro células) exige a borda inteira — 16 cm (80%) não escora', () => {
    const narrow = { depthM: 0.2, heightM: 0.3, widthM: 0.2 }
    const support = createSupportMap(BED, 'lineEnd')
    support.stamp({ slot: { ...narrow, heightM: 0.9 }, topM: 0.9, xM: 0, yM: CANDIDATE_Y_M })
    support.stamp({ slot: { depthM: 0.16, heightM: 1, widthM: CANDIDATE_Y_M }, topM: 1, xM: 0, yM: 0 })

    expect(support.isConfined({ baseM: 0.9, enclosed: true, slot: narrow, topM: 0.6, xM: 0, yM: CANDIDATE_Y_M })).toBe(
      false,
    )
  })

  /**
   * ⚠️ Sem baú fechado a D1 não vale: aplicada aos quatro lados, a Daily real desenhava 480 caixas contra
   * 481 (`exact-edges`, `complement`). A decisão do usuário é para o baú fechado.
   */
  describe('sem baú fechado: os quatro lados, a borda inteira', () => {
    /** A candidata no meio (`x` de 0,45 a 0,75): as duas laterais e a cabeceira precisam de vizinha. */
    const MIDDLE_X_M = 0.45
    const sides = (coveredM: number, doorCoveredM: number): readonly Neighbour[] => [
      { depthM: coveredM, widthM: CANDIDATE_Y_M, xM: MIDDLE_X_M, yM: 0 },
      { depthM: 0.3, widthM: coveredM, xM: MIDDLE_X_M - 0.3, yM: CANDIDATE_Y_M },
      { depthM: 0.3, widthM: coveredM, xM: MIDDLE_X_M + 0.3, yM: CANDIDATE_Y_M },
      { depthM: doorCoveredM, widthM: 0.3, xM: MIDDLE_X_M, yM: CANDIDATE_Y_M + 0.3 },
    ]

    test('os quatro lados inteiros — escorada', () => {
      expect(isConfined(mapWith(sides(0.3, 0.3), MIDDLE_X_M), { enclosed: false, xM: MIDDLE_X_M })).toBe(true)
    })

    test('cabeceira e laterais a 80% — solta: a fração é só do baú fechado', () => {
      expect(isConfined(mapWith(sides(0.24, 0.3), MIDDLE_X_M), { enclosed: false, xM: MIDDLE_X_M })).toBe(false)
    })

    test('a porta a 80% não escora', () => {
      expect(isConfined(mapWith(sides(0.3, 0.24), MIDDLE_X_M), { enclosed: false, xM: MIDDLE_X_M })).toBe(false)
    })
  })
})
