import { describe, expect, it } from 'bun:test'

import { toDateTimeAttribute } from './participantDay'

describe('toDateTimeAttribute', () => {
  it('writes the local calendar day, zero padded', () => {
    expect(toDateTimeAttribute(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toDateTimeAttribute(new Date(2026, 9, 12, 0, 1))).toBe('2026-10-12')
  })

  it('keeps the local day when the instant already crosses midnight UTC, in any timezone', () => {
    const lateLocalEvening = new Date(2026, 9, 8, 23, 30)
    const earlyLocalMorning = new Date(2026, 9, 9, 0, 30)
    expect(toDateTimeAttribute(lateLocalEvening)).toBe('2026-10-08')
    expect(toDateTimeAttribute(earlyLocalMorning)).toBe('2026-10-09')
  })

  it('never reads the UTC day, even in a timezone where it equals the local one', () => {
    const date = Object.assign(new Date(2026, 9, 8, 23, 30), { toISOString: () => '2026-10-09T02:30:00.000Z' })
    expect(toDateTimeAttribute(date)).toBe('2026-10-08')
  })
})
