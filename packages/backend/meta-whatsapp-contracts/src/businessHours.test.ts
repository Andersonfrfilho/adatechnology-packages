/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { isWithinBusinessHours, type BusinessHours } from './businessHours'
import { DEFAULT_PREVIEW_CONTACT, isPreviewContact, toPreviewContact } from './previewContact'

const HOURS: BusinessHours = {
  timeZone: 'America/Sao_Paulo',
  windows: [
    { weekday: 3, start: '08:00', end: '18:00' },
    { weekday: 6, start: '09:00', end: '12:00' },
  ],
  closedDates: ['2026-12-25'],
}

describe('isWithinBusinessHours', () => {
  it('uses the configured time zone', () => {
    // Quarta 2026-11-25, 17:59 e 18:00 em São Paulo.
    expect(isWithinBusinessHours(HOURS, new Date('2026-11-25T20:59:00Z'))).toBe(true)
    expect(isWithinBusinessHours(HOURS, new Date('2026-11-25T21:00:00Z'))).toBe(false)
  })

  it('is closed on other weekdays and closed dates', () => {
    expect(isWithinBusinessHours(HOURS, new Date('2026-11-26T15:00:00Z'))).toBe(false)
    expect(isWithinBusinessHours({ ...HOURS, closedDates: ['2026-11-25'] }, new Date('2026-11-25T15:00:00Z'))).toBe(
      false,
    )
  })
})

describe('preview contact', () => {
  it('starts with zero, which no real wa_id does', () => {
    expect(isPreviewContact(DEFAULT_PREVIEW_CONTACT)).toBe(true)
    expect(isPreviewContact('5511999990000')).toBe(false)
    expect(toPreviewContact('+55 11 98888-0000')).toBe('05511988880000')
    expect(toPreviewContact('0123')).toBe('0123')
  })
})
