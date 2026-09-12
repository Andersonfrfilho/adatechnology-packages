/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { UNPLACED_REASONS, resolveCargoPlacement, type PlacementBox } from '../../src/cargo-placement.policy.js'

/** Baú de truck medido: 7,40 × 2,47 × 2,30 m — o mesmo da frota de teste (spec 094). */
const BED = {
  heightM: '2.300',
  lengthM: '7.400',
  source: 'measured' as const,
  widthM: '2.470',
} as const

function box(overrides: Partial<PlacementBox>): PlacementBox {
  return {
    count: 1,
    heightMm: 400,
    isFragile: null,
    isStackable: null,
    keepUpright: null,
    label: 'CAIXA',
    lengthMm: 600,
    maxStackCount: null,
    source: 'measured',
    stopSequence: 1,
    widthMm: 400,
    ...overrides,
  }
}

function totalPlaced(plan: ReturnType<typeof resolveCargoPlacement>): number {
  return plan?.layers.reduce((total, layer) => total + layer.boxes.length, 0) ?? 0
}

function totalUnplaced(plan: ReturnType<typeof resolveCargoPlacement>): number {
  return plan?.unplaced.reduce((total, entry) => total + entry.count, 0) ?? 0
}

describe('empacotamento respeita um orçamento de tempo (spec 145)', () => {
  test('inclui time_budget entre os motivos de sobra', () => {
    expect(UNPLACED_REASONS).toContain('time_budget')
  })

  /** ⚠️ Prazo já vencido antes da primeira caixa: nada é tentado, e nada some (spec 085). */
  test('prazo já vencido não coloca nenhuma caixa, e tudo vira time_budget', () => {
    const boxes = [box({ count: 4 })]
    const plan = resolveCargoPlacement({ bed: BED, boxes, deadline: 1_000, now: () => 2_000 })

    expect(totalPlaced(plan)).toBe(0)
    expect(plan?.unplaced).toEqual([{ count: 4, label: 'CAIXA', reason: 'time_budget' }])
    expect(totalPlaced(plan) + totalUnplaced(plan)).toBe(4)
  })

  /**
   * ⚠️ O relógio avança a cada checagem — uma por caixa/unidade — e vence no meio da varredura. O
   * que já foi colocado fica colocado, o resto vira `time_budget`, e o prefixo é idêntico ao de uma
   * corrida sem prazo (spec 145 D9): o prazo só decide onde parar, nunca o que ou onde colocar.
   */
  test('vence no meio da varredura: o já colocado fica, e o prefixo bate com a corrida sem prazo', () => {
    const boxes = [box({ count: 4 })]
    let calls = 0
    const now = (): number => {
      calls += 1
      return calls
    }

    const withDeadline = resolveCargoPlacement({ bed: BED, boxes, deadline: 3, now })
    const reference = resolveCargoPlacement({ bed: BED, boxes })

    const placedCount = totalPlaced(withDeadline)
    expect(placedCount).toBeGreaterThan(0)
    expect(placedCount).toBeLessThan(4)
    expect(totalPlaced(withDeadline) + totalUnplaced(withDeadline)).toBe(4)
    expect(withDeadline?.unplaced.every((entry) => entry.reason === 'time_budget')).toBe(true)

    const placedWithDeadline = withDeadline?.layers.flatMap((layer) => layer.boxes) ?? []
    const placedReference = (reference?.layers.flatMap((layer) => layer.boxes) ?? []).slice(0, placedCount)
    expect(placedWithDeadline).toEqual(placedReference)
  })

  /** ⚠️ Prazo tão distante que nunca vence: o resultado tem de ser o mesmo de não ter prazo nenhum. */
  test('prazo distante no futuro devolve o mesmo resultado de uma corrida sem prazo', () => {
    const boxes = [box({ count: 6 })]

    const withDeadline = resolveCargoPlacement({ bed: BED, boxes, deadline: Number.MAX_SAFE_INTEGER })
    const reference = resolveCargoPlacement({ bed: BED, boxes })

    expect(withDeadline).toEqual(reference)
  })
})
