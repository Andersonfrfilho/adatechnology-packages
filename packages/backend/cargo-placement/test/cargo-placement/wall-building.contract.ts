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

/**
 * Spec 148 D1: **no baú fechado a carga é montada em parede, a partir do canto.** A primeira pilha de cada
 * fileira nasce encostada na cabeceira (parede do fundo ou fileira anterior) e numa parede lateral; as
 * seguintes encostam na cabeceira e na pilha anterior. Sem `enclosedBody` o desenho não muda.
 *
 * ⚠️ O juiz lê só as caixas publicadas, como o de `enclosed-body.contract.ts`: parede a menos do giro da
 * pilha (`3b/√10`), ou vizinha que cobre a face inteira dentro do giro e sobe ao lado dela.
 */
const TOLERANCE_M = 1e-3
const STEP_M = 0.005
const RISES_ALONGSIDE_M = 0.01
const EPSILON = 1e-9

const BED = { heightM: '2.20', lengthM: '7.40', source: 'measured', widthM: '2.47' } as const
const LENGTH_M = Number(BED.lengthM)
const WIDTH_M = Number(BED.widthM)

/** Quatro entregas, quatro formatos: 60 caixas que cabem com folga no baú. */
const SHAPES = [
  { count: 6, heightMm: 400, lengthMm: 500, widthMm: 400 },
  { count: 4, heightMm: 500, lengthMm: 600, widthMm: 400 },
  { count: 3, heightMm: 300, lengthMm: 400, widthMm: 300 },
  { count: 2, heightMm: 500, lengthMm: 800, widthMm: 600 },
] as const

const BOXES: readonly PlacementBox[] = [1, 2, 3, 4].flatMap((stopSequence) =>
  SHAPES.map((shape) => ({
    ...shape,
    isFragile: null,
    isStackable: null,
    keepUpright: null,
    label: `P${String(stopSequence)}`,
    maxStackCount: null,
    source: 'measured' as const,
    stopSequence,
  })),
)

/**
 * Uma caixa só, quatro entregas: com tamanho único a fileira existe de fato — com tamanhos misturados a
 * caixa de preenchimento entra entre fileiras e "fileira" deixa de ser uma medida.
 */
const UNIFORM_BOXES: readonly PlacementBox[] = [1, 2, 3, 4].map((stopSequence) => ({
  count: 15,
  heightMm: 500,
  isFragile: null,
  isStackable: null,
  keepUpright: null,
  label: `U${String(stopSequence)}`,
  lengthMm: 600,
  maxStackCount: null,
  source: 'measured' as const,
  stopSequence,
  widthMm: 400,
}))

/** Impressão digital do desenho sem `enclosedBody`, medida no `0925c14` — ver o último teste. */
const BASE_OPEN_FINGERPRINT = '10303136107426709627'
/** O comprimento do baú que a carga misturada ocupava no baú fechado, medido no `0925c14`. */
const BASE_ENCLOSED_BLOCK_LENGTH_M = 2.3

function place(enclosedBody: boolean, boxes: readonly PlacementBox[] = BOXES): CargoPlacement {
  const plan = resolveCargoPlacement({
    arrangement: 'depth',
    bed: BED,
    boxes,
    deliveryReachM: 2,
    enclosedBody,
    payloadRatio: '0.3',
    securesCargo: false,
  })
  if (plan === null) throw new Error('a planta devia existir com o baú medido')

  return plan
}

const enclosedPlan = place(true)
const openPlan = place(false)
const uniformPlan = place(true, UNIFORM_BOXES)

function drawnOf(plan: CargoPlacement): PlacedBox[] {
  return plan.layers.flatMap((layer) => layer.boxes)
}

function fingerprintOf(plan: CargoPlacement): string {
  const rows = drawnOf(plan)
    .map((box) => [box.xM, box.yM, box.zM, box.depthM, box.widthM, box.heightM, box.stopSequence].join(','))
    .sort()
  const unplaced = plan.unplaced.map((entry) => `${entry.label}:${entry.reason}:${String(entry.count)}`)

  return String(Bun.hash([...rows, ...unplaced].join(';')))
}

/** Uma face da caixa segurada por parede (a menos de `gapM`) ou por vizinha que cobre a face inteira. */
function faceHolds(
  box: PlacedBox,
  boxes: readonly PlacedBox[],
  face: Readonly<{ alongX: boolean; front: boolean; wallCounts: boolean; gapM: number; fromZM: number }>,
): boolean {
  const { alongX, front, gapM } = face
  const faceM = alongX ? (front ? box.xM + box.depthM : box.xM) : front ? box.yM + box.widthM : box.yM
  const wallGapM = alongX ? (front ? LENGTH_M - faceM : faceM) : front ? WIDTH_M - faceM : faceM
  if (face.wallCounts && wallGapM < gapM + TOLERANCE_M) return true
  const topM = box.zM + box.heightM
  const near = boxes.filter(
    (other) =>
      other !== box &&
      other.zM < topM - RISES_ALONGSIDE_M + EPSILON &&
      other.zM + other.heightM >= face.fromZM - EPSILON,
  )
  const fromM = alongX ? box.yM : box.xM
  const sizeM = alongX ? box.widthM : box.depthM
  const steps = Math.max(1, Math.round(sizeM / STEP_M))
  for (let step = 0; step < steps; step += 1) {
    const pointM = fromM + (step + 0.5) * (sizeM / steps)
    const braced = near.some((other) => {
      const [otherFromM, otherSizeM, otherNearM, otherFarM] = alongX
        ? [other.yM, other.widthM, other.xM, other.xM + other.depthM]
        : [other.xM, other.depthM, other.yM, other.yM + other.widthM]
      if (pointM < otherFromM || pointM >= otherFromM + otherSizeM) return false
      const faceGapM = front ? otherNearM - faceM : faceM - otherFarM
      return faceGapM > -TOLERANCE_M && faceGapM < gapM + TOLERANCE_M
    })
    if (!braced) return false
  }

  return true
}

function isTall(box: PlacedBox): boolean {
  return box.zM + box.heightM > Math.min(box.depthM, box.widthM) * STABLE_STACK_SLENDERNESS + EPSILON
}

/** Pilha alta: cabeceira + uma lateral, dentro do giro da pilha — o juiz da D23. */
function isEnclosedBraced(box: PlacedBox, boxes: readonly PlacedBox[]): boolean {
  const baseM = Math.min(box.depthM, box.widthM)
  const topM = box.zM + box.heightM
  const fromZM = Math.max(0, Math.min(box.zM, topM - baseM * STABLE_STACK_SLENDERNESS))
  const gapM = (baseM * STABLE_STACK_SLENDERNESS) / Math.hypot(STABLE_STACK_SLENDERNESS, 1)
  const holds = (alongX: boolean, front: boolean): boolean =>
    faceHolds(box, boxes, { alongX, front, fromZM, gapM, wallCounts: true })

  return holds(true, false) && (holds(false, false) || holds(false, true))
}

/**
 * As fileiras do piso: caixas no chão que começam na mesma distância da cabeceira. A pilha da ponta de
 * cada fileira — a mais perto de uma parede lateral — é a primeira que a montagem ergueu nela.
 */
function floorRowsOf(boxes: readonly PlacedBox[]): readonly (readonly PlacedBox[])[] {
  const rows = new Map<number, PlacedBox[]>()
  for (const box of boxes.filter((entry) => entry.zM < TOLERANCE_M)) {
    const key = Math.round(box.xM * 1000)
    rows.set(key, [...(rows.get(key) ?? []), box])
  }

  return [...rows.values()]
}

/**
 * A pilha da ponta está no canto: encostada numa parede lateral e, no sentido da cabeceira, na face de trás
 * do bloco ou numa caixa da fileira anterior.
 *
 * ⚠️ A face de trás do bloco, e não `x = 0`: o bloco inteiro anda para a porta dentro da folga da escora da
 * testeira (spec 134), e esse deslocamento é o mesmo para todas as caixas.
 */
function startsInCorner(row: readonly PlacedBox[], boxes: readonly PlacedBox[]): boolean {
  const backM = boxes.reduce((start, box) => Math.min(start, box.xM), LENGTH_M)

  return row.some(
    (box) =>
      (box.yM < TOLERANCE_M || box.yM + box.widthM > WIDTH_M - TOLERANCE_M) &&
      (box.xM < backM + TOLERANCE_M ||
        faceHolds(box, boxes, { alongX: true, front: false, fromZM: 0, gapM: 0, wallCounts: false })),
  )
}

describe('montagem em parede no baú fechado (spec 148 D1)', () => {
  test('toda caixa pedida é desenhada', () => {
    expect(enclosedPlan.unplaced).toEqual([])
    expect(drawnOf(enclosedPlan).length).toBe(60)
  })

  test('a primeira pilha de cada fileira fica no canto: cabeceira + parede lateral', () => {
    const boxes = drawnOf(uniformPlan)
    const loose = floorRowsOf(boxes).filter((row) => !startsInCorner(row, boxes))

    expect(uniformPlan.unplaced).toEqual([])
    expect(loose.map((row) => row.map((box) => [box.xM, box.yM]))).toEqual([])
  })

  test.each([
    ['misturada', enclosedPlan],
    ['uniforme', uniformPlan],
  ] as const)('carga %s: toda pilha alta tem encosto no sentido da cabeceira e numa lateral', (_name, plan) => {
    const boxes = drawnOf(plan)
    const tall = boxes.filter(isTall)

    expect(tall.length).toBeGreaterThan(0)
    expect(tall.filter((box) => !isEnclosedBraced(box, boxes))).toEqual([])
  })

  /**
   * ⚠️ Medido no `0925c14` (camadas pela fileira): a mesma carga ocupava 2,30 m do comprimento do baú. Com a
   * montagem em parede as pilhas sobem até o teto antes de a carga andar para a porta.
   */
  test('as pilhas sobem antes de a carga andar para a porta: o bloco ocupa menos que os 2,30 m da base', () => {
    const boxes = drawnOf(enclosedPlan)
    const lengthM =
      boxes.reduce((end, box) => Math.max(end, box.xM + box.depthM), 0) -
      boxes.reduce((start, box) => Math.min(start, box.xM), LENGTH_M)

    expect(lengthM).toBeLessThan(BASE_ENCLOSED_BLOCK_LENGTH_M - TOLERANCE_M)
  })

  test('sem baú fechado o desenho é idêntico ao da base (0925c14)', () => {
    expect(fingerprintOf(openPlan)).toBe(BASE_OPEN_FINGERPRINT)
  })
})
