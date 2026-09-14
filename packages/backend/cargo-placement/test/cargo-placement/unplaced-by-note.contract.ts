/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { resolveCargoPlacement, type PlacementBox } from '../../src/cargo-placement.policy.js'

/**
 * Spec 148 (pré-requisito da T7): **o que ficou de fora vem por nota.** Cada linha de `unplaced` leva o
 * `documentId` da nota; duas notas da mesma parada não se somam numa linha só. Quem lê o formato antigo
 * continua achando `label`, `reason` e `count` em cada linha, e a soma por rótulo não muda.
 */
const BED = { heightM: '0.50', lengthM: '0.60', source: 'measured', widthM: '0.60' } as const

function noteBoxes(documentId: string, count: number): PlacementBox {
  return {
    count,
    documentId,
    documentNumber: null,
    heightMm: 400,
    isFragile: null,
    isStackable: false,
    keepUpright: true,
    label: 'P1',
    lengthMm: 500,
    maxStackCount: null,
    source: 'measured',
    stopSequence: 1,
    widthMm: 500,
  }
}

const plan = resolveCargoPlacement({
  bed: BED,
  boxes: [noteBoxes('nota-a', 3), noteBoxes('nota-b', 2)],
  enclosedBody: true,
  payloadRatio: '0.1',
  securesCargo: false,
})

describe('o que ficou de fora vem por nota (spec 148, T7)', () => {
  test('cada linha de `unplaced` tem a nota, e a soma por nota fecha com o que não foi desenhado', () => {
    if (plan === null) throw new Error('a planta devia existir com o baú medido')
    const drawn = plan.layers.flatMap((layer) => layer.boxes)
    const outByNote = new Map<string, number>()
    for (const entry of plan.unplaced) {
      expect(entry.documentId).toBeDefined()
      outByNote.set(String(entry.documentId), (outByNote.get(String(entry.documentId)) ?? 0) + entry.count)
    }

    for (const [documentId, total] of [
      ['nota-a', 3],
      ['nota-b', 2],
    ] as const) {
      const placed = drawn.filter((box) => box.documentId === documentId).length
      expect(outByNote.get(documentId) ?? 0).toBe(total - placed)
    }
  })

  test('formato antigo: `label`, `reason` e `count` seguem em cada linha, e a soma por rótulo não muda', () => {
    if (plan === null) throw new Error('a planta devia existir com o baú medido')
    const drawn = plan.layers.flatMap((layer) => layer.boxes).length

    for (const entry of plan.unplaced) {
      expect(entry.label).toBe('P1')
      expect(typeof entry.reason).toBe('string')
      expect(entry.count).toBeGreaterThan(0)
    }
    expect(plan.unplaced.reduce((total, entry) => total + entry.count, 0)).toBe(5 - drawn)
  })
})
