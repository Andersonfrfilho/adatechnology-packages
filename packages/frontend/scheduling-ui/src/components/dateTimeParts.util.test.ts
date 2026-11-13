/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { buildYearOptions, daysInMonth, formatDateTimeParts, parseDateTimeParts } from './dateTimeParts.util'

describe('parseDateTimeParts', () => {
  test('quebra o texto do campo em partes', () => {
    expect(parseDateTimeParts('2026-08-21T14:30')).toEqual({
      year: 2026,
      month: 8,
      day: 21,
      time: '14:30',
    })
  })

  test('texto incompleto nao vira parte nenhuma', () => {
    expect(parseDateTimeParts('')).toBeUndefined()
    expect(parseDateTimeParts('2026-08-21')).toBeUndefined()
  })
})

describe('daysInMonth', () => {
  test('conhece fevereiro nos dois tipos de ano', () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28)
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29)
  })

  test('conhece o mes de 30 e o de 31', () => {
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30)
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31)
  })
})

describe('formatDateTimeParts', () => {
  test('remonta o texto do campo', () => {
    expect(formatDateTimeParts({ year: 2026, month: 8, day: 21, time: '14:30' })).toBe('2026-08-21T14:30')
  })

  /** 31 de marco com o mes trocado para fevereiro nao pode virar 3 de marco. */
  test('apara o dia que nao existe no mes escolhido', () => {
    expect(formatDateTimeParts({ year: 2026, month: 2, day: 31, time: '09:00' })).toBe('2026-02-28T09:00')
    expect(formatDateTimeParts({ year: 2028, month: 2, day: 31, time: '09:00' })).toBe('2028-02-29T09:00')
  })
})

describe('buildYearOptions', () => {
  const TODAY = new Date('2026-08-21T00:00:00Z')

  test('abre a janela em torno do ano corrente', () => {
    expect(buildYearOptions({ year: 2026, today: TODAY, past: 1, future: 2 })).toEqual([2025, 2026, 2027, 2028])
  })

  /** Reserva antiga aberta para consulta: o proprio valor entra, ou o campo mostraria outro ano. */
  test('estica a janela para caber o valor do campo', () => {
    expect(buildYearOptions({ year: 2019, today: TODAY, past: 1, future: 1 })).toContain(2019)
    expect(buildYearOptions({ year: 2031, today: TODAY, past: 1, future: 1 })).toContain(2031)
  })
})
