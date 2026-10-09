import { describe, expect, it } from 'bun:test'

import { toDateTimeAttribute } from './participantDay'

describe('toDateTimeAttribute', () => {
  it('writes the local calendar day, zero padded', () => {
    expect(toDateTimeAttribute(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(toDateTimeAttribute(new Date(2026, 9, 12, 0, 1))).toBe('2026-10-12')
  })
})
