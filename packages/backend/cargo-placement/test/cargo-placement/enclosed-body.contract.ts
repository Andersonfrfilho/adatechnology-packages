/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import {
  resolveCargoPlacement,
  STABLE_STACK_SLENDERNESS,
  type CargoPlacement,
  type PlacedBox,
  type PlacementBox,
} from '../../src/cargo-placement.policy.js'
import { createMixedLoad, MIXED_BEDS } from '../../src/fixtures/mixed-cargo-bank.fixture.js'
import {
  ACCELO_24_STOPS,
  DAILY_19_STOPS,
  SPRINTER_24_STOPS,
  type RealCargoRow,
} from '../../src/fixtures/real-mixed-cargo.fixture.js'

/**
 * D23: **no baú fechado a pilha alta se escora na cabeceira e numa lateral.** Pilha alta é a que passa de
 * `STABLE_STACK_SLENDERNESS` vezes a menor base; com `enclosedBody` ela precisa de escora na cabeceira
 * **e** em pelo menos uma lateral, e a porta nunca é exigida. Sem `enclosedBody` valem os quatro lados;
 * com `securesCargo` a cinta manda e a esbeltez não rege.
 *
 * ⚠️ O juiz é **independente do empacotador**: lê só as bordas das caixas publicadas — parede a menos do
 * giro da pilha (`3b/√10`), ou caixa vizinha que cobre a face inteira dentro do giro, sobe ao lado dela e
 * chega até onde a contenção precisa. Reusar o mapa de apoio mediria a implementação contra ela mesma.
 */
const STEP_M = 0.005
const TOLERANCE_M = 1e-3
const RISES_ALONGSIDE_M = 0.01
const EPSILON = 1e-9

type Bed = Readonly<{ heightM: string; lengthM: string; source: 'measured' | 'reference'; widthM: string }>
type Load = Readonly<{ bed: Bed; boxes: readonly PlacementBox[]; name: string; payloadRatio: string }>
type Side = 'door' | 'headboard' | 'left' | 'right'

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

function bedNamed(name: string): (typeof MIXED_BEDS)[number] {
  const bed = MIXED_BEDS.find((entry) => entry.name === name)
  if (bed === undefined) throw new Error(`o banco de baús não tem ${name}`)

  return bed
}

const REAL_LOADS: readonly Load[] = [
  { ...bedNamed('Daily'), boxes: toBoxes(DAILY_19_STOPS) },
  { ...bedNamed('Sprinter'), boxes: toBoxes(SPRINTER_24_STOPS) },
  { ...bedNamed('Accelo'), boxes: toBoxes(ACCELO_24_STOPS) },
]
/**
 * ⚠️ Sem o Atego misto: são 8 s com baú fechado e 15 s sem, e a suíte roda a cada mudança. Ele e as viagens
 * reais maiores ficam na auditoria de bancada da T18, com o mesmo juiz.
 */
const MIXED_LOADS: readonly Load[] = MIXED_BEDS.filter((bed) => bed.name !== 'Atego').map((bed) => ({
  ...bed,
  boxes: createMixedLoad({ bed: bed.bed, occupancy: 0.5, seed: 1, shapeCount: 6 }).boxes,
  name: `${bed.name} misto`,
}))
const ALL_LOADS = [...REAL_LOADS, ...MIXED_LOADS]

type Flags = Readonly<{ enclosedBody?: boolean; securesCargo?: boolean }>

/** Uma planta por carga e combinação: o mesmo desenho serve a várias afirmações. */
const plans = new Map<string, CargoPlacement>()

function place(load: Load, flags: Flags): CargoPlacement {
  const key = `${load.name}|${String(flags.enclosedBody === true)}|${String(flags.securesCargo === true)}`
  const known = plans.get(key)
  if (known !== undefined) return known
  const plan = resolveCargoPlacement({ bed: load.bed, boxes: load.boxes, payloadRatio: load.payloadRatio, ...flags })
  if (plan === null) throw new Error('a planta devia existir com o baú medido')
  plans.set(key, plan)

  return plan
}

function drawnOf(plan: CargoPlacement): PlacedBox[] {
  return plan.layers.flatMap((layer) => layer.boxes)
}

function isTall(box: PlacedBox): boolean {
  return box.zM + box.heightM > Math.min(box.depthM, box.widthM) * STABLE_STACK_SLENDERNESS + EPSILON
}

/**
 * D25 (spec 148 D9): no baú fechado a vizinha escora cobrindo 80% da borda — menos do lado da porta e na
 * borda de até 25 cm, que seguem exigindo a borda inteira. Fora do baú fechado, a borda inteira.
 */
const ENCLOSED_BRACED_EDGE_FRACTION = 0.8
const MIN_FRACTIONAL_EDGE_M = 0.25

/** Os lados que seguram a pilha alta — a porta só por caixa, nunca por parede. */
function bracedSides(box: PlacedBox, boxes: readonly PlacedBox[], bed: Bed, enclosed: boolean): ReadonlySet<Side> {
  const lengthM = Number(bed.lengthM)
  const widthM = Number(bed.widthM)
  const baseM = Math.min(box.depthM, box.widthM)
  const topM = box.zM + box.heightM
  const restraintM = Math.max(0, Math.min(box.zM, topM - baseM * STABLE_STACK_SLENDERNESS))
  const catchGapM = (baseM * STABLE_STACK_SLENDERNESS) / Math.hypot(STABLE_STACK_SLENDERNESS, 1)
  const near = boxes.filter(
    (other) =>
      other !== box &&
      other.zM < topM - RISES_ALONGSIDE_M + EPSILON &&
      other.zM + other.heightM >= restraintM - EPSILON &&
      other.xM < box.xM + box.depthM + catchGapM &&
      other.xM + other.depthM > box.xM - catchGapM &&
      other.yM < box.yM + box.widthM + catchGapM &&
      other.yM + other.widthM > box.yM - catchGapM,
  )
  const holds = (alongX: boolean, front: boolean, wallCounts: boolean): boolean => {
    const faceM = alongX ? (front ? box.xM + box.depthM : box.xM) : front ? box.yM + box.widthM : box.yM
    const wallGapM = alongX ? (front ? lengthM - faceM : faceM) : front ? widthM - faceM : faceM
    if (wallCounts && wallGapM < catchGapM - EPSILON) return true
    const fromM = alongX ? box.yM : box.xM
    const sizeM = alongX ? box.widthM : box.depthM
    const steps = Math.max(1, Math.round(sizeM / STEP_M))
    const isFractional = enclosed && !(alongX && front) && sizeM >= MIN_FRACTIONAL_EDGE_M - TOLERANCE_M
    const looseAllowed = isFractional ? Math.floor(steps * (1 - ENCLOSED_BRACED_EDGE_FRACTION) + EPSILON) : 0
    let loose = 0
    for (let step = 0; step < steps; step += 1) {
      const pointM = fromM + (step + 0.5) * (sizeM / steps)
      const braced = near.some((other) => {
        const [otherFromM, otherSizeM, otherNearM, otherFarM] = alongX
          ? [other.yM, other.widthM, other.xM, other.xM + other.depthM]
          : [other.xM, other.depthM, other.yM, other.yM + other.widthM]
        if (pointM < otherFromM || pointM >= otherFromM + otherSizeM) return false
        const gapM = front ? otherNearM - faceM : faceM - otherFarM
        return gapM > -TOLERANCE_M && gapM < catchGapM - EPSILON
      })
      if (!braced) loose += 1
      if (loose > looseAllowed) return false
    }
    return true
  }
  const sides = new Set<Side>()
  if (holds(true, false, true)) sides.add('headboard')
  if (holds(true, true, false)) sides.add('door')
  if (holds(false, false, true)) sides.add('left')
  if (holds(false, true, true)) sides.add('right')

  return sides
}

function isEnclosedBraced(sides: ReadonlySet<Side>): boolean {
  return sides.has('headboard') && (sides.has('left') || sides.has('right'))
}

function isFullyBraced(sides: ReadonlySet<Side>): boolean {
  return sides.size === 4
}

function tallSidesOf(load: Load, flags: Flags): ReadonlySet<Side>[] {
  const boxes = drawnOf(place(load, flags))

  return boxes.filter(isTall).map((box) => bracedSides(box, boxes, load.bed, flags.enclosedBody === true))
}

describe('baú fechado: a pilha alta escora na cabeceira e numa lateral (D23)', () => {
  test.each(ALL_LOADS.map((load) => [load.name, load] as const))(
    '%s: nenhuma pilha alta sem cabeceira ou sem lateral — recomendado e complemento',
    (_name, load) => {
      const sides = tallSidesOf(load, { enclosedBody: true })

      expect(sides.filter((side) => !isEnclosedBraced(side))).toEqual([])
    },
    // Carga real e mista: o desenho leva 3–4 s sozinho e passa de 5 s com a máquina ou o CI carregados.
    0,
  )

  test('cabeceira + lateral bastam: o baú fechado sobe pilha alta que os quatro lados recusariam', () => {
    const accepted = ALL_LOADS.flatMap((load) =>
      tallSidesOf(load, { enclosedBody: true }).filter((side) => !isFullyBraced(side)),
    )

    expect(accepted.length).toBeGreaterThan(0)
  })

  test('a porta não é exigida: há pilha alta aceita sem nada do lado da porta', () => {
    const doorless = ALL_LOADS.flatMap((load) =>
      tallSidesOf(load, { enclosedBody: true }).filter((side) => !side.has('door')),
    )

    expect(doorless.length).toBeGreaterThan(0)
  })

  test.each(ALL_LOADS.map((load) => [load.name, load] as const))(
    '%s sem baú fechado: a pilha alta continua escorada nos quatro lados',
    (_name, load) => {
      const sides = tallSidesOf(load, {})

      expect(sides.filter((side) => !isFullyBraced(side))).toEqual([])
    },
    // Mesma carga real e mista do caso de cima: passa de 5 s no runner do CI.
    0,
  )

  test('com cinta a esbeltez segue livre: há pilha alta sem a escora do baú fechado', () => {
    const free = ALL_LOADS.flatMap((load) =>
      tallSidesOf(load, { enclosedBody: true, securesCargo: true }).filter((side) => !isEnclosedBraced(side)),
    )

    expect(free.length).toBeGreaterThan(0)
  })
})
