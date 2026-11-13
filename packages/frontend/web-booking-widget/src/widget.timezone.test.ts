/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { formatSlotDate, formatSlotTime, resolveVisitorTimezone, toShortTimezoneLabel } from './widget.timezone'

describe('resolveVisitorTimezone', () => {
  it('returns a non-empty IANA timezone string', () => {
    expect(resolveVisitorTimezone().length).toBeGreaterThan(0)
  })
})

describe('formatSlotTime', () => {
  it('formats an ISO instant in the given timezone', () => {
    expect(formatSlotTime('2026-08-20T14:00:00Z', 'UTC')).toBe('14:00')
  })

  it('shifts the same instant when the timezone differs', () => {
    expect(formatSlotTime('2026-08-20T14:00:00Z', 'America/Manaus')).toBe('10:00')
  })
})

describe('formatSlotDate', () => {
  it('formats an ISO instant as a short date in the given timezone', () => {
    const formatted = formatSlotDate('2026-08-20T14:00:00Z', 'UTC')

    expect(formatted).toContain('20')
  })
})

describe('toShortTimezoneLabel', () => {
  it('keeps only the city segment', () => {
    expect(toShortTimezoneLabel('America/Manaus')).toBe('Manaus')
  })

  it('replaces underscores with spaces', () => {
    expect(toShortTimezoneLabel('America/Sao_Paulo')).toBe('Sao Paulo')
  })

  it('falls back to the raw value when there is no slash', () => {
    expect(toShortTimezoneLabel('UTC')).toBe('UTC')
  })
})
