/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import {
  DELIVERY_REACH_M,
  isComplementBox,
  resolveCargoPlacement,
  type CargoPlacement,
  type PlacedBox,
  type PlacementBox,
} from '../../src/cargo-placement.policy.js'
import { DAILY_19_STOPS, type RealCargoRow } from '../../src/fixtures/real-mixed-cargo.fixture.js'

/**
 * D24: **o alcance da mão é parâmetro da entrada.** Ausente continua `DELIVERY_REACH_M` — quem não passa
 * nada recebe o desenho de antes, byte a byte. Maior, a entrega mais cedo sobe na carga das seguintes além
 * dos 0,6 m; `null` tira o teto.
 *
 * ⚠️ As afirmações são de **propriedade** — o desenho não muda sem o parâmetro, e mais alcance nunca põe
 * menos entrega em cima das posteriores —, nunca a posição de uma caixa.
 */
const DAILY_BED = { heightM: '1.800', lengthM: '4.200', source: 'measured', widthM: '2.100' } as const
const DAILY_PAYLOAD_RATIO = '0.9007'
const EPSILON = 1e-6
const SEAT_TOLERANCE_M = 1e-3

function toBoxes(rows: readonly RealCargoRow[]): PlacementBox[] {
  return rows.map(([stopSequence, count, lengthMm, widthMm, heightMm, measured]) => ({
    count,
    heightMm,
    isFragile: null,
    isStackable: null,
    keepUpright: null,
    label: `P${String(stopSequence)}`,
    lengthMm,
    maxStackCount: null,
    source: measured === 1 ? ('measured' as const) : ('estimated' as const),
    stopSequence,
    widthMm,
  }))
}

const DAILY_BOXES = toBoxes(DAILY_19_STOPS)

function placeDaily(options: Readonly<{ deliveryReachM?: number | null; enclosedBody?: boolean }>): CargoPlacement {
  const plan = resolveCargoPlacement({
    bed: DAILY_BED,
    boxes: DAILY_BOXES,
    payloadRatio: DAILY_PAYLOAD_RATIO,
    ...options,
  })
  if (plan === null) throw new Error('a Daily tem baú medido')

  return plan
}

function drawnOf(plan: CargoPlacement): PlacedBox[] {
  return plan.layers.flatMap((layer) => layer.boxes)
}

function overlaps(fromA: number, sizeA: number, fromB: number, sizeB: number): boolean {
  return fromA < fromB + sizeB - EPSILON && fromB < fromA + sizeA - EPSILON
}

/** Caixa do mapa recomendado sentada em cima de carga de uma entrega posterior. */
function countOnLaterCargo(plan: CargoPlacement): number {
  const boxes = drawnOf(plan)

  return boxes.filter(
    (box) =>
      !isComplementBox(box) &&
      box.zM > SEAT_TOLERANCE_M &&
      boxes.some(
        (other) =>
          other.stopSequence > box.stopSequence &&
          Math.abs(other.zM + other.heightM - box.zM) < SEAT_TOLERANCE_M &&
          overlaps(box.xM, box.depthM, other.xM, other.depthM) &&
          overlaps(box.yM, box.widthM, other.yM, other.widthM),
      ),
  ).length
}

function countUnplaced(plan: CargoPlacement): number {
  return plan.unplaced.reduce((total, entry) => total + entry.count, 0)
}

describe('o alcance da mão como parâmetro (D24)', () => {
  test.each([false, true])(
    'ausente é o alcance de sempre: o mesmo desenho que passar DELIVERY_REACH_M (baú fechado %p)',
    (enclosedBody) => {
      expect(DELIVERY_REACH_M).toBe(0.6)
      expect(placeDaily({ enclosedBody })).toEqual(placeDaily({ deliveryReachM: DELIVERY_REACH_M, enclosedBody }))
    },
  )

  /**
   * ⚠️ Na Daily sem baú fechado o teto de 0,6 m deixa caixa para o complemento (`needsRehandling`): a entrega
   * não alcança o topo das seguintes e fura a ordem. Sem teto ela sobe ali, no mapa recomendado.
   */
  test.each([1.2, null])('com alcance %p a entrega mais cedo sobe mais na carga das seguintes', (deliveryReachM) => {
    const bounded = placeDaily({})
    const wider = placeDaily({ deliveryReachM })

    expect(countOnLaterCargo(wider)).toBeGreaterThan(countOnLaterCargo(bounded))
    expect(drawnOf(wider).filter(isComplementBox).length).toBeLessThan(drawnOf(bounded).filter(isComplementBox).length)
    expect(countUnplaced(wider)).toBeLessThanOrEqual(countUnplaced(bounded))
  })

  test.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])('alcance %p é recusado na fronteira', (deliveryReachM) => {
    expect(() => placeDaily({ deliveryReachM })).toThrow(RangeError)
  })
})
