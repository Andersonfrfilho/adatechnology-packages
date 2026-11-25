/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { flowNodeDataSchema } from './flow.types'
import { parseFlowTime, readFlowTimeWindows, validateFlowAnswer } from './flowAnswer'

const CLOCK = { now: new Date('2026-11-25T18:00:00Z'), timeZone: 'America/Sao_Paulo' }

describe('parseFlowTime', () => {
  it('accepts colon, h-suffixed and h-separated times', () => {
    expect(parseFlowTime('12:30')).toBe('12:30')
    expect(parseFlowTime('12h30')).toBe('12:30')
    expect(parseFlowTime('12h')).toBe('12:00')
    expect(parseFlowTime('9h')).toBe('09:00')
    expect(parseFlowTime('9H')).toBe('09:00')
    expect(parseFlowTime(' 9hs ')).toBe('09:00')
    expect(parseFlowTime('9:05')).toBe('09:05')
    expect(parseFlowTime('19:30h')).toBe('19:30')
  })

  it('rejects bare numbers and impossible times', () => {
    expect(parseFlowTime('12')).toBeUndefined()
    expect(parseFlowTime('24:00')).toBeUndefined()
    expect(parseFlowTime('12:60')).toBeUndefined()
    expect(parseFlowTime('meio dia')).toBeUndefined()
    expect(parseFlowTime('12h3')).toBeUndefined()
  })
})

describe('readFlowTimeWindows', () => {
  it('reads objects and HH:MM-HH:MM strings, skipping malformed items', () => {
    expect(readFlowTimeWindows([{ start: '11:00', end: '14:00' }, '19h-23h', 'x', 3])).toEqual([
      { start: '11:00', end: '14:00' },
      { start: '19:00', end: '23:00' },
    ])
    expect(readFlowTimeWindows(undefined)).toBeUndefined()
  })
})

describe('validateFlowAnswer — time', () => {
  const node = { questionType: 'time' as const }

  it('normalizes to HH:MM', () => {
    expect(validateFlowAnswer({ node, answer: '12h30', context: {}, clock: CLOCK })).toEqual({
      isValid: true,
      value: '12:30',
      isSkipped: false,
    })
    expect(validateFlowAnswer({ node, answer: 'meio dia', context: {}, clock: CLOCK })).toEqual({
      isValid: false,
      rejection: 'invalid-format',
    })
  })

  it('enforces minTime and maxTime inclusively', () => {
    const bounded = { ...node, validation: { minTime: '11:00', maxTime: '22:00' } }
    expect(validateFlowAnswer({ node: bounded, answer: '10h', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'before-min-time',
    })
    expect(validateFlowAnswer({ node: bounded, answer: '22:30', context: {}, clock: CLOCK })).toMatchObject({
      rejection: 'after-max-time',
    })
    expect(validateFlowAnswer({ node: bounded, answer: '22h', context: {}, clock: CLOCK })).toMatchObject({
      isValid: true,
      value: '22:00',
    })
  })

  it('checks the windows the host put in the context, including windows past midnight', () => {
    const windowed = { ...node, validation: { windowsContextKey: 'openWindows' } }
    const context = { openWindows: ['11:00-14:00', { start: '22:00', end: '02:00' }] }
    const check = (answer: string) => validateFlowAnswer({ node: windowed, answer, context, clock: CLOCK })
    expect(check('12h')).toMatchObject({ isValid: true })
    expect(check('23:30')).toMatchObject({ isValid: true })
    expect(check('1h')).toMatchObject({ isValid: true })
    expect(check('16h')).toMatchObject({ isValid: false, rejection: 'outside-allowed-windows' })
  })

  it('does not restrict when the context has no window list', () => {
    const windowed = { ...node, validation: { windowsContextKey: 'openWindows' } }
    expect(validateFlowAnswer({ node: windowed, answer: '16h', context: {}, clock: CLOCK })).toMatchObject({
      isValid: true,
    })
  })

  it('is accepted by the graph schema, with possibleNext on action nodes', () => {
    const parsed = flowNodeDataSchema.safeParse({
      id: 'q',
      type: 'question',
      questionType: 'time',
      validation: { minTime: '11:00', windowsContextKey: 'openWindows' },
      possibleNext: ['full', 'flow:waitlist'],
    })
    expect(parsed.success).toBe(true)
  })
})
