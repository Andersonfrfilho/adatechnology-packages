/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { placeOverEarlierDeliveries, type PlacedBox, type PlacementBox } from '../../src/cargo-placement.policy.js'

/**
 * Spec 148 D5 + D6: **a passada final do baú fechado.** A caixa que nem a varredura nem o complemento
 * colocaram tenta os vãos que sobraram — os mais altos primeiro, em qualquer orientação que `keepUpright`
 * permita —, **inclusive por cima de entrega anterior**. É a única passada que fura a ordem de descarga, e ela
 * marca a caixa: `overEarlierDelivery` + `needsRehandling`, e `coversStops` com as entregas que ela cobre.
 * A física não afrouxa: 80% de apoio, D23/D25, nada sobre caixa frágil ou não empilhável, alcance de 2 m.
 *
 * Coordenadas do bloco por entrega: `x` corre entre as laterais (1,0 m), `y` da cabeceira (`y = 0`) à porta
 * (1,2 m), altura 0,9 m. A entrega 2 (desce depois) enche a metade da cabeceira até o teto; a entrega 1 (desce
 * antes) forra a metade da porta a 0,30 m. O único vão é por cima da entrega 1.
 */
const BED = { heightM: 0.9, lengthM: 1, widthM: 1.2 }

function placedBox(
  input: Readonly<{ stop: number; xM: number; yM: number; zM: number; isFragile?: boolean }>,
): PlacedBox {
  return {
    depthM: 0.5,
    documentId: `nota-${String(input.stop)}`,
    documentNumber: null,
    heightM: 0.3,
    isFragile: input.isFragile === true,
    label: `P${String(input.stop)}`,
    layer: Math.round(input.zM / 0.3),
    reasons: ['lastStopFirst'],
    source: 'measured',
    stopSequence: input.stop,
    widthM: 0.6,
    xM: input.xM,
    yM: input.yM,
    zM: input.zM,
  }
}

function loadedBed(isFragile = false): PlacedBox[] {
  const later = [0, 0.5].flatMap((xM) => [0, 0.3, 0.6].map((zM) => placedBox({ stop: 2, xM, yM: 0, zM })))
  const earlier = [0, 0.5].map((xM) => placedBox({ isFragile, stop: 1, xM, yM: 0.6, zM: 0 }))

  return [...later, ...earlier]
}

function leftover(
  input: Readonly<{ heightMm: number; keepUpright: boolean | null; lengthMm: number; widthMm: number }>,
): PlacementBox {
  return {
    count: 1,
    documentId: 'nota-2',
    documentNumber: null,
    heightMm: input.heightMm,
    isFragile: null,
    isStackable: null,
    keepUpright: input.keepUpright,
    label: 'P2',
    lengthMm: input.lengthMm,
    maxStackCount: null,
    source: 'measured',
    stopSequence: 2,
    widthMm: input.widthMm,
  }
}

function runPass(
  placed: readonly PlacedBox[],
  rejected: readonly PlacementBox[],
): ReturnType<typeof placeOverEarlierDeliveries> {
  return placeOverEarlierDeliveries({
    bed: BED,
    enclosedBody: true,
    placed,
    reachM: 2,
    rejected,
    securesCargo: false,
  })
}

describe('passada final: por cima de entrega anterior, marcada (spec 148 D5/D6)', () => {
  test('a caixa que só cabe por cima da entrega 1 entra lá, marcada e com a entrega coberta', () => {
    const result = runPass(loadedBed(), [leftover({ heightMm: 300, keepUpright: null, lengthMm: 500, widthMm: 600 })])

    expect(result.rejected).toEqual([])
    expect(result.boxes).toHaveLength(1)
    const [box] = result.boxes
    expect(box?.zM).toBeCloseTo(0.3, 6)
    expect(box?.reasons).toContain('overEarlierDelivery')
    expect(box?.reasons).toContain('needsRehandling')
    expect(box?.coversStops).toEqual([1])
  })

  test('D6: a caixa alta demais em pé entra deitada quando `keepUpright` não proíbe', () => {
    const result = runPass(loadedBed(), [leftover({ heightMm: 700, keepUpright: false, lengthMm: 300, widthMm: 300 })])

    expect(result.rejected).toEqual([])
    expect(result.boxes[0]?.heightM).toBeCloseTo(0.3, 6)
  })

  test('`keepUpright` manda: a mesma caixa, que só cabe deitada, fica de fora', () => {
    const result = runPass(loadedBed(), [leftover({ heightMm: 700, keepUpright: true, lengthMm: 300, widthMm: 300 })])

    expect(result.boxes).toEqual([])
    expect(result.rejected).toHaveLength(1)
  })

  test('nada pousa sobre caixa frágil: com a entrega 1 frágil, a caixa fica de fora', () => {
    const result = runPass(loadedBed(true), [
      leftover({ heightMm: 300, keepUpright: null, lengthMm: 500, widthMm: 600 }),
    ])

    expect(result.boxes).toEqual([])
    expect(result.rejected).toHaveLength(1)
  })
})

/**
 * Spec 148 D5: a sombra (a carga de entrega posterior na frente, mais alta que a base) é ordem de descarga, e é
 * justamente o que esta passada fura: a caixa entra, marcada `needsRehandling` — alguém mexe na entrega
 * posterior para chegar nela. Sem cobrir entrega anterior, ela não leva `overEarlierDelivery`.
 */
describe('passada final: atrás de entrega posterior, marcada para retrabalho (spec 148 D5)', () => {
  test('o único vão fica atrás da coluna da entrega 3: a caixa da entrega 2 entra lá, com retrabalho', () => {
    const later = [0, 0.5].flatMap((xM) => [0, 0.3, 0.6].map((zM) => placedBox({ stop: 3, xM, yM: 0.6, zM })))
    const result = runPass(later, [leftover({ heightMm: 300, keepUpright: null, lengthMm: 500, widthMm: 600 })])

    expect(result.rejected).toEqual([])
    expect(result.boxes).toHaveLength(1)
    expect(result.boxes[0]?.reasons).toContain('needsRehandling')
    expect(result.boxes[0]?.reasons).not.toContain('overEarlierDelivery')
    expect(result.boxes[0]?.coversStops).toBeUndefined()
  })
})
