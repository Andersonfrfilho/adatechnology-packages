/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { reorganizeForLeftovers, type PlacedBox, type PlacementBox } from '../../src/cargo-placement.policy.js'

/**
 * Spec 148 D4 (T3b): **reorganizar para quem ficou de fora.** O vão do fundo, no alto, está longe da mão para
 * a primeira parada, mas serve para uma caixa da entrega tardia. A reorganização sobe a caixa tardia que ocupa
 * o espaço alcançável para o vão do fundo, e a caixa de fora entra no lugar liberado. A troca só vale com tudo
 * valendo — apoio de 80%, D23/D25, porta sem escora, alcance para todas as caixas e ordem de descarga — e
 * só no baú fechado.
 *
 * Coordenadas do bloco por entrega: `x` entre as laterais (1,0 m), `y` da cabeceira (`y = 0`) à porta (1,2 m),
 * altura 0,6 m, alcance de 0,5 m. No fundo, a entrega 2 forra o piso a 0,10 m. Perto da porta, a caixa B da
 * entrega 2 (0,50 m de altura) e a caixa E da entrega 1 (até o teto). A caixa R da entrega 1 não cabe em cima
 * de B e, no fundo, fica longe da mão (0,60 m > 0,50 m): só entra se B subir para o fundo.
 */
const BED = { heightM: 0.6, lengthM: 1, widthM: 1.2 }
const REACH_M = 0.5

function placed(input: Readonly<{ stop: number; xM: number; yM: number; zM: number; heightM: number }>): PlacedBox {
  return {
    depthM: 0.5,
    documentId: `nota-${String(input.stop)}`,
    documentNumber: null,
    heightM: input.heightM,
    isFragile: false,
    label: `P${String(input.stop)}`,
    layer: 0,
    reasons: ['lastStopFirst'],
    source: 'measured',
    stopSequence: input.stop,
    widthM: 0.6,
    xM: input.xM,
    yM: input.yM,
    zM: input.zM,
  }
}

const LOADED: readonly PlacedBox[] = [
  placed({ heightM: 0.1, stop: 2, xM: 0, yM: 0, zM: 0 }),
  placed({ heightM: 0.1, stop: 2, xM: 0.5, yM: 0, zM: 0 }),
  placed({ heightM: 0.5, stop: 2, xM: 0, yM: 0.6, zM: 0 }),
  placed({ heightM: 0.6, stop: 1, xM: 0.5, yM: 0.6, zM: 0 }),
]

const LEFTOVER: PlacementBox = {
  count: 1,
  documentId: 'nota-1',
  documentNumber: null,
  heightMm: 300,
  isFragile: null,
  isStackable: null,
  keepUpright: true,
  label: 'P1',
  lengthMm: 500,
  maxStackCount: null,
  source: 'measured',
  stopSequence: 1,
  widthMm: 600,
}

function run(enclosedBody: boolean): ReturnType<typeof reorganizeForLeftovers> {
  return reorganizeForLeftovers({
    bed: BED,
    enclosedBody,
    placed: LOADED,
    reachM: REACH_M,
    rejected: [LEFTOVER],
    securesCargo: false,
  })
}

describe('reorganizar para quem ficou de fora (spec 148 D4)', () => {
  test('a caixa tardia sobe para o vão do fundo e a caixa de fora entra no lugar dela', () => {
    const result = run(true)

    expect(result.rejected).toEqual([])
    expect(result.moved).toBe(1)
    const leftover = result.boxes.find((box) => box.stopSequence === 1 && box.heightM === 0.3)
    expect(leftover?.zM).toBeCloseTo(0, 6)
    expect(leftover?.yM).toBeCloseTo(0.6, 6)
    const lifted = result.boxes.find((box) => box.stopSequence === 2 && box.heightM === 0.5)
    expect(lifted?.yM).toBeCloseTo(0, 6)
    expect(lifted?.zM).toBeCloseTo(0.1, 6)
  })

  test('sem baú fechado nada muda: a caixa segue de fora e ninguém sai do lugar', () => {
    const result = run(false)

    expect(result.moved).toBe(0)
    expect(result.rejected).toEqual([LEFTOVER])
    expect(result.boxes).toEqual(LOADED)
  })
})
