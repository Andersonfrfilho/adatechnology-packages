/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { resolveCargoLayout } from '../../src/cargo-layout.policy.js'
import { isComplementBox, resolveCargoPlacement, resolveStopArrangement } from '../../src/cargo-placement.policy.js'
import { createMixedLoad, MIXED_BEDS } from '../../src/fixtures/mixed-cargo-bank.fixture.js'

/**
 * Spec 145 (e spec 148 T3b): **o prazo vale para o cálculo inteiro de `resolveCargoLayout`.** A decisão do
 * arranjo empacota a carga antes do desenho, e o desenho reusa esse pacote; se o prazo não chegar à decisão,
 * o empacotamento inteiro roda sem ele e só o desenho — que já veio pronto — o recebe.
 */
const STOPS = [
  {
    boxes: [
      { count: 2, documentId: 'nota-a', documentNumber: '101', heightMm: 300, lengthMm: 400, widthMm: 300 },
      { count: 3, documentId: 'nota-b', documentNumber: '102', heightMm: 200, lengthMm: 300, widthMm: 200 },
    ],
    clientName: 'Cliente',
    documentsWithoutVolume: 0,
    label: 'Parada 1',
    noteNumbers: ['101', '102'],
    sequence: 1,
    volumeM3: '0.500000',
  },
  {
    boxes: [{ count: 4, heightMm: 250, lengthMm: 350, widthMm: 250 }],
    clientName: 'Outro',
    documentsWithoutVolume: 0,
    label: 'Parada 2',
    noteNumbers: [],
    sequence: 2,
    volumeM3: '0.400000',
  },
]

describe('o prazo vale para o cálculo inteiro da planta (spec 145)', () => {
  test('prazo já vencido: nenhuma caixa é desenhada, e todas voltam como time_budget', () => {
    const layout = resolveCargoLayout({
      bedDimensions: { heightM: '1.800', lengthM: '4.200', source: 'measured', widthM: '2.100' },
      capacityM3: '15.876000',
      deadline: 1_000,
      enclosedBody: true,
      fallbackBoxVolumeM3: 0.02,
      loadingAccess: 'rear',
      measuredShapes: [],
      now: () => 2_000,
      payloadRatio: null,
      stops: STOPS,
    })
    const placement = layout?.placement
    const drawn = placement?.layers.flatMap((layer) => layer.boxes).length ?? 0
    const timedOut = (placement?.unplaced ?? [])
      .filter((entry) => entry.reason === 'time_budget')
      .reduce((total, entry) => total + entry.count, 0)

    expect(drawn).toBe(0)
    expect(timedOut).toBe(9)
  })
})

/**
 * Spec 148: **as passadas finais também respeitam o prazo.** A decisão do arranjo empacota a profundidade sem
 * prazo — o arranjo tem de sair o mesmo com ou sem ele (spec 145) —, e o desenho reusa esse pacote. A passada
 * por cima e a reorganização rodam dentro dele; elas não mudam o mapa recomendado, então recebem o prazo à
 * parte. Vencido, elas não colocam nada, e o arranjo e o mapa recomendado continuam os mesmos.
 */
describe('as passadas finais respeitam o prazo, sem mudar a decisão do arranjo (spec 148)', () => {
  const SPRINTER = MIXED_BEDS.find((entry) => entry.name === 'Sprinter')
  if (SPRINTER === undefined) throw new Error('o banco de baús não tem Sprinter')

  function planOf(timing: Readonly<{ deadline?: number; now?: () => number }>): {
    readonly arrangement: string
    readonly over: number
    readonly recommended: readonly string[]
  } {
    const sprinter = SPRINTER as NonNullable<typeof SPRINTER>
    /** Caixas novas a cada chamada: o pacote guardado é por identidade, e cada teste quer o seu. */
    const boxes = createMixedLoad({ bed: sprinter.bed, occupancy: 0.5, seed: 1, shapeCount: 6 }).boxes
    const decision = resolveStopArrangement({
      bed: sprinter.bed,
      boxes,
      enclosedBody: true,
      loadingAccess: 'rear',
      payloadRatio: sprinter.payloadRatio,
      ...timing,
    })
    const plan = resolveCargoPlacement({
      arrangement: decision.arrangement,
      ...(decision.laneCount === undefined ? {} : { laneCount: decision.laneCount }),
      bed: sprinter.bed,
      boxes,
      enclosedBody: true,
      loadingAccess: 'rear',
      payloadRatio: sprinter.payloadRatio,
      ...timing,
    })
    const drawn = plan?.layers.flatMap((layer) => layer.boxes) ?? []

    return {
      arrangement: decision.arrangement,
      over: drawn.filter((box) => box.reasons.includes('overEarlierDelivery')).length,
      recommended: drawn
        .filter((box) => !isComplementBox(box))
        .map((box) => [box.stopSequence, box.xM, box.yM, box.zM].join('|'))
        .sort(),
    }
  }

  test('sem prazo, a passada final põe caixa por cima de entrega anterior nesta carga', () => {
    expect(planOf({}).over).toBeGreaterThan(0)
  })

  test('prazo vencido: nenhuma caixa por cima, e o arranjo e o mapa recomendado não mudam', () => {
    const free = planOf({})
    const expired = planOf({ deadline: 1_000, now: () => 2_000 })

    expect(expired.over).toBe(0)
    expect(expired.arrangement).toBe(free.arrangement)
    expect(expired.recommended).toEqual(free.recommended)
  })
})
