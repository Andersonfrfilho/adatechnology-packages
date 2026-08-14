/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import { GoogleCalendarError } from './google-calendar-provider.error'
import { createGoogleCalendarProvider } from './google-calendar-provider.factory'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function buildProvider(fetchImpl: typeof fetch) {
  return createGoogleCalendarProvider({
    calendarId: 'primary',
    getAccessToken: async () => 'token-abc',
    fetchImpl,
  })
}

describe('createGoogleCalendarProvider', () => {
  it('rejeita configuração sem calendarId', () => {
    expect(() => createGoogleCalendarProvider({ calendarId: '  ', getAccessToken: async () => 'token' })).toThrow(
      GoogleCalendarError,
    )
  })

  describe('upsertEvent', () => {
    it('cria evento novo com POST quando não há externalCalendarId', async () => {
      const requests: { method: string; url: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '', url: String(url) })
        return jsonResponse(200, { id: 'google-event-1' })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const outcome = await provider.upsertEvent({
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      })

      expect(outcome).toEqual({ outcome: 'synced', externalEventId: 'google-event-1' })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.method).toBe('POST')
      expect(requests[0]?.url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    })

    it('atualiza evento existente com PATCH quando há externalCalendarId', async () => {
      const requests: { method: string; url: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '', url: String(url) })
        return jsonResponse(200, { id: 'google-event-1' })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      await provider.upsertEvent({
        externalCalendarId: 'google-event-1',
        title: 'Consulta remarcada',
        startsAt: new Date('2026-08-21T10:00:00.000Z'),
        endsAt: new Date('2026-08-21T11:00:00.000Z'),
      })

      expect(requests[0]?.method).toBe('PATCH')
      expect(requests[0]?.url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events/google-event-1')
    })

    it('devolve outcome failed quando a API responde erro', async () => {
      const fetchImpl = (async () => jsonResponse(401, {})) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      const outcome = await provider.upsertEvent({
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      })

      expect(outcome.outcome).toBe('failed')
      if (outcome.outcome === 'failed') {
        expect(outcome.errorCode).toBe('http_401')
      }
    })
  })

  describe('deleteEvent', () => {
    it('remove o evento com DELETE', async () => {
      const requests: { method: string; url: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '', url: String(url) })
        return new Response(null, { status: 204 })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      await provider.deleteEvent('google-event-1')

      expect(requests[0]?.method).toBe('DELETE')
    })

    it('trata 404 e 410 como remoção idempotente, sem lançar', async () => {
      const notFound = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
      const gone = (async () => new Response(null, { status: 410 })) as unknown as typeof fetch

      await expect(buildProvider(notFound).deleteEvent('google-event-1')).resolves.toBeUndefined()
      await expect(buildProvider(gone).deleteEvent('google-event-1')).resolves.toBeUndefined()
    })

    it('lança GoogleCalendarError para outros erros HTTP', async () => {
      const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(provider.deleteEvent('google-event-1')).rejects.toThrow(GoogleCalendarError)
    })
  })

  describe('readEvents', () => {
    it('mapeia os eventos retornados pela API', async () => {
      const fetchImpl = (async () =>
        jsonResponse(200, {
          items: [
            {
              id: 'google-event-1',
              start: { dateTime: '2026-08-20T10:00:00.000Z' },
              end: { dateTime: '2026-08-20T11:00:00.000Z' },
            },
          ],
        })) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const events = await provider.readEvents({
        from: new Date('2026-08-20T00:00:00.000Z'),
        until: new Date('2026-08-21T00:00:00.000Z'),
      })

      expect(events).toEqual([
        {
          externalEventId: 'google-event-1',
          startsAt: new Date('2026-08-20T10:00:00.000Z'),
          endsAt: new Date('2026-08-20T11:00:00.000Z'),
        },
      ])
    })

    it('lança GoogleCalendarError quando a API falha', async () => {
      const fetchImpl = (async () => jsonResponse(500, {})) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(
        provider.readEvents({
          from: new Date('2026-08-20T00:00:00.000Z'),
          until: new Date('2026-08-21T00:00:00.000Z'),
        }),
      ).rejects.toThrow(GoogleCalendarError)
    })
  })
})
