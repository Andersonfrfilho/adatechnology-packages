/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import {
  FLOW_DATE_LOCALE_EN_US,
  parseFlowCpf,
  parseFlowDate,
  parseFlowInteger,
  parseFlowMoney,
  validateFlowAnswer,
} from './flowAnswer'

// 2026-11-25 15:00 em São Paulo (UTC-3).
const NOW = new Date('2026-11-25T18:00:00Z')
const CLOCK = { now: NOW, timeZone: 'America/Sao_Paulo' }

describe('parseFlowDate', () => {
  it('parses relative words, short and full dates', () => {
    expect(parseFlowDate('hoje', CLOCK)).toBe('2026-11-25')
    expect(parseFlowDate('Amanhã', CLOCK)).toBe('2026-11-26')
    expect(parseFlowDate('depois de amanha', CLOCK)).toBe('2026-11-27')
    expect(parseFlowDate('24/12', CLOCK)).toBe('2026-12-24')
    expect(parseFlowDate('24/12/27', CLOCK)).toBe('2027-12-24')
    expect(parseFlowDate('2027-01-02', CLOCK)).toBe('2027-01-02')
  })

  it('rolls a past day-month into next year', () => {
    expect(parseFlowDate('05/01', CLOCK)).toBe('2027-01-05')
  })

  it('rejects impossible dates and free text', () => {
    expect(parseFlowDate('31/02', CLOCK)).toBeUndefined()
    expect(parseFlowDate('sexta que vem', CLOCK)).toBeUndefined()
  })

  it('follows the locale order', () => {
    expect(parseFlowDate('12/24/2026', { ...CLOCK, locale: FLOW_DATE_LOCALE_EN_US })).toBe('2026-12-24')
    expect(parseFlowDate('tomorrow', { ...CLOCK, locale: FLOW_DATE_LOCALE_EN_US })).toBe('2026-11-26')
  })
})

describe('number parsers', () => {
  it('reads one integer from a sentence', () => {
    expect(parseFlowInteger('somos 4')).toBe(4)
    expect(parseFlowInteger('4 ou 5')).toBeUndefined()
    expect(parseFlowInteger('2,5')).toBeUndefined()
  })

  it('reads money in both separators', () => {
    expect(parseFlowMoney('R$ 1.234,56')).toBe(1234.56)
    expect(parseFlowMoney('1.234')).toBe(1234)
    expect(parseFlowMoney('12.50')).toBe(12.5)
    expect(parseFlowMoney('$1,234.56', '.')).toBe(1234.56)
    expect(parseFlowMoney('nada')).toBeUndefined()
  })

  it('checks CPF digits', () => {
    expect(parseFlowCpf('529.982.247-25')).toBe('52998224725')
    expect(parseFlowCpf('529.982.247-24')).toBeUndefined()
    expect(parseFlowCpf('111.111.111-11')).toBeUndefined()
  })
})

describe('validateFlowAnswer', () => {
  it('enforces minDate today and afterContextKey', () => {
    const node = { questionType: 'date' as const, validation: { minDate: 'today', afterContextKey: 'checkIn' } }
    expect(validateFlowAnswer({ node, answer: '20/11/2026', context: {}, clock: CLOCK })).toEqual({
      isValid: false,
      rejection: 'before-min-date',
    })
    expect(validateFlowAnswer({ node, answer: '26/11', context: { checkIn: '2026-11-26' }, clock: CLOCK })).toEqual({
      isValid: false,
      rejection: 'not-after-reference',
    })
    expect(validateFlowAnswer({ node, answer: '27/11', context: { checkIn: '2026-11-26' }, clock: CLOCK })).toEqual({
      isValid: true,
      value: '2026-11-27',
      isSkipped: false,
    })
  })

  it('enforces integer range', () => {
    const node = { questionType: 'int' as const, validation: { min: 1, max: 8 } }
    expect(validateFlowAnswer({ node, answer: '0', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'below-min',
    })
    expect(validateFlowAnswer({ node, answer: '9', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'above-max',
    })
    expect(validateFlowAnswer({ node, answer: 'somos 3', context: {}, clock: CLOCK })).toMatchObject({ value: 3 })
  })

  it('enforces text length and accepts skip keywords', () => {
    const node = { questionType: 'text' as const, validation: { minLength: 3, maxLength: 10 }, skipKeywords: ['pular'] }
    expect(validateFlowAnswer({ node, answer: 'ok', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'too-short',
    })
    expect(validateFlowAnswer({ node, answer: 'texto comprido demais', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'too-long',
    })
    expect(validateFlowAnswer({ node, answer: 'Pular', context: {}, clock: CLOCK })).toEqual({
      isValid: true,
      value: null,
      isSkipped: true,
    })
  })

  it('rejects invalid cpf and empty answers', () => {
    expect(
      validateFlowAnswer({ node: { questionType: 'cpf' }, answer: '123', context: {}, clock: CLOCK }),
    ).toMatchObject({
      rejection: 'invalid-format',
    })
    expect(validateFlowAnswer({ node: {}, answer: '  ', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'empty',
    })
  })
})
