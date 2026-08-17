/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import { toBookingResult, toResources, toServices, toSlots } from './widget.mapper'

describe('toServices', () => {
  it('maps well-formed rows', () => {
    const services = toServices([
      { id: 'svc_1', name: 'Corte', description: 'Corte simples', durationMinutes: 30, priceInCents: 5000 },
    ])

    expect(services).toEqual([
      { id: 'svc_1', name: 'Corte', description: 'Corte simples', durationMinutes: 30, priceInCents: 5000 },
    ])
  })

  it('defaults missing description and price', () => {
    const services = toServices([{ id: 'svc_1', name: 'Corte', durationMinutes: 30 }])

    expect(services).toEqual([
      { id: 'svc_1', name: 'Corte', description: null, durationMinutes: 30, priceInCents: null },
    ])
  })

  it('drops malformed rows instead of throwing', () => {
    const services = toServices([
      { id: 'svc_1' },
      null,
      'not-an-object',
      { id: 'svc_2', name: 'Barba', durationMinutes: 15 },
    ])

    expect(services).toEqual([
      { id: 'svc_2', name: 'Barba', description: null, durationMinutes: 15, priceInCents: null },
    ])
  })

  it('returns empty for a non-array payload', () => {
    expect(toServices(undefined)).toEqual([])
    expect(toServices({ id: 'not-a-list' })).toEqual([])
  })
})

describe('toResources', () => {
  it('maps well-formed rows', () => {
    const resources = toResources([{ id: 'res_1', name: 'Ana', timezone: 'America/Manaus' }])

    expect(resources).toEqual([{ id: 'res_1', name: 'Ana', timezone: 'America/Manaus' }])
  })

  it('drops a row missing timezone', () => {
    const resources = toResources([{ id: 'res_1', name: 'Ana' }])

    expect(resources).toEqual([])
  })
})

describe('toSlots', () => {
  it('maps well-formed rows', () => {
    const slots = toSlots([{ resourceId: 'res_1', startsAt: '2026-08-20T14:00:00Z', endsAt: '2026-08-20T14:30:00Z' }])

    expect(slots).toEqual([{ resourceId: 'res_1', startsAt: '2026-08-20T14:00:00Z', endsAt: '2026-08-20T14:30:00Z' }])
  })

  it('drops a row missing endsAt', () => {
    const slots = toSlots([{ resourceId: 'res_1', startsAt: '2026-08-20T14:00:00Z' }])

    expect(slots).toEqual([])
  })
})

describe('toBookingResult', () => {
  it('maps a well-formed payload', () => {
    expect(toBookingResult({ bookingId: 'bkg_1', status: 'confirmed' })).toEqual({
      bookingId: 'bkg_1',
      status: 'confirmed',
    })
  })

  it('defaults a missing status to empty string', () => {
    expect(toBookingResult({ bookingId: 'bkg_1' })).toEqual({ bookingId: 'bkg_1', status: '' })
  })

  it('throws when bookingId is missing', () => {
    expect(() => toBookingResult({ status: 'confirmed' })).toThrow()
  })
})
