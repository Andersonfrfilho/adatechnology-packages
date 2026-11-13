/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * H-C: sem `Idempotency-Key`, uma retentativa de rede na mesma tentativa de reserva vira uma
 * segunda reserva — o servidor sabe fazer replay por essa chave (`bookingRoutes.ts`), mas só se
 * o cliente mandar uma.
 */

import { afterEach, describe, expect, it, mock } from 'bun:test'

import { WidgetApi } from './widget.api'

function buildFetchMock(body: unknown, status = 201): typeof fetch {
  return mock(async () => new Response(JSON.stringify({ data: body }), { status })) as unknown as typeof fetch
}

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('WidgetApi.requestBooking — Idempotency-Key', () => {
  it('envia um header Idempotency-Key com valor não vazio', async () => {
    const fetchMock = buildFetchMock({ bookingId: 'booking-1', status: 'confirmed' })
    global.fetch = fetchMock

    const api = new WidgetApi({ baseUrl: 'https://example.com' })
    await api.requestBooking({
      serviceId: 'service-1',
      resourceId: 'resource-1',
      slot: { resourceId: 'resource-1', startsAt: '2026-08-20T10:00:00.000Z', endsAt: '2026-08-20T10:30:00.000Z' },
      customerName: 'Visitante',
      customerContact: 'visitante@example.com',
    })

    const [, init] = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>

    expect(headers['idempotency-key']).toBeString()
    expect(headers['idempotency-key'].length).toBeGreaterThan(0)
  })

  it('gera uma chave diferente a cada tentativa de reserva', async () => {
    const fetchMock = buildFetchMock({ bookingId: 'booking-1', status: 'confirmed' })
    global.fetch = fetchMock

    const api = new WidgetApi({ baseUrl: 'https://example.com' })
    const bookingParams = {
      serviceId: 'service-1',
      resourceId: 'resource-1',
      slot: { resourceId: 'resource-1', startsAt: '2026-08-20T10:00:00.000Z', endsAt: '2026-08-20T10:30:00.000Z' },
      customerName: 'Visitante',
      customerContact: 'visitante@example.com',
    }

    await api.requestBooking(bookingParams)
    await api.requestBooking(bookingParams)

    const calls = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls as [string, RequestInit][]
    const firstKey = (calls[0]?.[1].headers as Record<string, string>)['idempotency-key']
    const secondKey = (calls[1]?.[1].headers as Record<string, string>)['idempotency-key']

    expect(firstKey).not.toBe(secondKey)
  })
})
