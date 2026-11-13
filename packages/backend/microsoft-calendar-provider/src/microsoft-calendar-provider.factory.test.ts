/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import { MicrosoftCalendarError } from './microsoft-calendar-provider.error'
import { createMicrosoftCalendarProvider } from './microsoft-calendar-provider.factory'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function buildProvider(fetchImpl: typeof fetch) {
  return createMicrosoftCalendarProvider({ getAccessToken: async () => 'token-abc', fetchImpl })
}

describe('createMicrosoftCalendarProvider', () => {
  it('rejeita configuração sem getAccessToken válido', () => {
    expect(() =>
      createMicrosoftCalendarProvider({ getAccessToken: undefined as unknown as () => Promise<string> }),
    ).toThrow(MicrosoftCalendarError)
  })

  it('rejeita calendarId em branco quando informado', () => {
    expect(() => createMicrosoftCalendarProvider({ getAccessToken: async () => 'token', calendarId: '  ' })).toThrow(
      MicrosoftCalendarError,
    )
  })

  describe('upsertEvent', () => {
    it('cria evento novo com POST em /me/events quando não há externalCalendarId', async () => {
      const requests: { method: string; url: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '', url: String(url) })
        return jsonResponse(200, { id: 'graph-event-1' })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const outcome = await provider.upsertEvent({
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      })

      expect(outcome).toEqual({ outcome: 'synced', externalEventId: 'graph-event-1' })
      expect(requests[0]?.method).toBe('POST')
      expect(requests[0]?.url).toBe('https://graph.microsoft.com/v1.0/me/events')
    })

    it('atualiza evento existente com PATCH quando há externalCalendarId', async () => {
      const requests: { method: string; url: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '', url: String(url) })
        return jsonResponse(200, { id: 'graph-event-1' })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      await provider.upsertEvent({
        externalCalendarId: 'graph-event-1',
        title: 'Consulta remarcada',
        startsAt: new Date('2026-08-21T10:00:00.000Z'),
        endsAt: new Date('2026-08-21T11:00:00.000Z'),
      })

      expect(requests[0]?.method).toBe('PATCH')
      expect(requests[0]?.url).toBe('https://graph.microsoft.com/v1.0/me/events/graph-event-1')
    })

    it('respeita calendarId quando informado', async () => {
      const requests: string[] = []
      const fetchImpl = (async (url: RequestInfo | URL) => {
        requests.push(String(url))
        return jsonResponse(200, { id: 'graph-event-1' })
      }) as unknown as typeof fetch

      const provider = createMicrosoftCalendarProvider({
        getAccessToken: async () => 'token',
        calendarId: 'shared-calendar',
        fetchImpl,
      })
      await provider.upsertEvent({
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      })

      expect(requests[0]).toBe('https://graph.microsoft.com/v1.0/me/calendars/shared-calendar/events')
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
      const requests: { method: string }[] = []
      const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ method: init?.method ?? '' })
        return new Response(null, { status: 204 })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      await provider.deleteEvent('graph-event-1')

      expect(requests[0]?.method).toBe('DELETE')
    })

    it('trata 404 como remoção idempotente, sem lançar', async () => {
      const notFound = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
      await expect(buildProvider(notFound).deleteEvent('graph-event-1')).resolves.toBeUndefined()
    })

    it('lança MicrosoftCalendarError para outros erros HTTP', async () => {
      const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(provider.deleteEvent('graph-event-1')).rejects.toThrow(MicrosoftCalendarError)
    })
  })

  describe('readEvents', () => {
    it('mapeia os eventos retornados pela calendarView', async () => {
      const requests: string[] = []
      const fetchImpl = (async (url: RequestInfo | URL) => {
        requests.push(String(url))
        return jsonResponse(200, {
          value: [
            {
              id: 'graph-event-1',
              start: { dateTime: '2026-08-20T10:00:00.0000000', timeZone: 'UTC' },
              end: { dateTime: '2026-08-20T11:00:00.0000000', timeZone: 'UTC' },
            },
          ],
        })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const events = await provider.readEvents({
        from: new Date('2026-08-20T00:00:00.000Z'),
        until: new Date('2026-08-21T00:00:00.000Z'),
      })

      expect(requests[0]).toContain('/me/calendarView')
      expect(events).toEqual([
        {
          externalEventId: 'graph-event-1',
          startsAt: new Date('2026-08-20T10:00:00.0000000Z'),
          endsAt: new Date('2026-08-20T11:00:00.0000000Z'),
        },
      ])
    })

    it('lança MicrosoftCalendarError quando a API falha', async () => {
      const fetchImpl = (async () => jsonResponse(500, {})) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(
        provider.readEvents({
          from: new Date('2026-08-20T00:00:00.000Z'),
          until: new Date('2026-08-21T00:00:00.000Z'),
        }),
      ).rejects.toThrow(MicrosoftCalendarError)
    })
  })
})
