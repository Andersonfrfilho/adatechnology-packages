/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import {
  addCompetenceMonths,
  amountInEffect,
  canTransitionOccurrence,
  competenceBounds,
  planAmountChange,
  planFixedExpenseOccurrences,
  resolveExpenseSlots,
} from './index'

describe('vencimentos da conta fixa', () => {
  it('mensal gera uma por mês na janela de 4 meses, dia 31 cai no último dia', () => {
    const planned = planFixedExpenseOccurrences({
      anchorCompetence: '2026-01',
      dueDay: 31,
      recurrence: 'monthly',
      today: '2026-01-20',
    })
    expect(planned.map((item) => item.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('trimestral conta a partir do mês de início', () => {
    const planned = planFixedExpenseOccurrences({
      anchorCompetence: '2025-12',
      dueDay: 10,
      recurrence: 'quarterly',
      today: '2026-01-05',
      windowMonths: 6,
    })
    expect(planned.map((item) => item.competence)).toEqual(['2026-03', '2026-06'])
  })

  it('quinzenal vence dia 15 e no último dia', () => {
    const slots = resolveExpenseSlots({
      anchorCompetence: '2026-02',
      competence: '2026-02',
      dueDay: null,
      recurrence: 'fortnightly',
    })
    expect(slots.map((slot) => [slot.slot, slot.dueDate])).toEqual([
      [1, '2026-02-15'],
      [2, '2026-02-28'],
    ])
  })

  it('parcelada para depois da última parcela', () => {
    const planned = planFixedExpenseOccurrences({
      anchorCompetence: '2026-01',
      dueDay: 5,
      installmentsTotal: 2,
      recurrence: 'monthly',
      today: '2026-01-01',
    })
    expect(planned.map((item) => item.installmentNumber)).toEqual([1, 2])
  })

  it('competências: soma de meses e limites do mês', () => {
    expect(addCompetenceMonths('2026-11', 3)).toBe('2027-02')
    expect(competenceBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('histórico de valor', () => {
  const changes = [
    { createdAt: '2026-03-01T10:00:00Z', effectiveCompetence: '2026-03', newAmount: '1100.00' },
    { createdAt: '2026-06-01T10:00:00Z', effectiveCompetence: '2026-06', newAmount: '1200.00' },
  ]

  it('o valor de uma competência é o da última mudança até ela', () => {
    expect(amountInEffect('1000.00', changes, '2026-02')).toBe('1000.00')
    expect(amountInEffect('1000.00', changes, '2026-05')).toBe('1100.00')
    expect(amountInEffect('1000.00', changes, '2026-09')).toBe('1200.00')
  })

  it('reajuste vale do mês pedido em diante e só regrava o que não venceu', () => {
    expect(
      planAmountChange({
        baseAmount: '1000.00',
        changes,
        effectiveFrom: '2026-08',
        newAmount: '1300',
        today: '2026-07-10',
      }),
    ).toEqual({
      effectiveCompetence: '2026-08',
      kind: 'adjustment',
      newAmount: '1300.00',
      onlyNotDue: true,
      previousAmount: '1200.00',
      untilCompetence: null,
    })
  })

  it('correção troca o trecho inteiro em que a competência está', () => {
    expect(
      planAmountChange({
        baseAmount: '1000.00',
        changes,
        correctionCompetence: '2026-04',
        kind: 'correction',
        newAmount: '1150.00',
        today: '2026-07-10',
      }),
    ).toMatchObject({ effectiveCompetence: '2026-03', kind: 'correction', untilCompetence: '2026-06' })
  })

  it('mesmo valor não grava nada', () => {
    expect(planAmountChange({ baseAmount: '1000.00', changes: [], newAmount: '1000', today: '2026-01-10' })).toBeNull()
  })
})

describe('ciclo da ocorrência', () => {
  it('aberta paga ou cancela; paga só reabre', () => {
    expect(canTransitionOccurrence('open', 'settle')).toBe(true)
    expect(canTransitionOccurrence('open', 'cancel')).toBe(true)
    expect(canTransitionOccurrence('paid', 'cancel')).toBe(false)
    expect(canTransitionOccurrence('paid', 'reopen')).toBe(true)
    expect(canTransitionOccurrence('canceled', 'reopen')).toBe(false)
  })
})
