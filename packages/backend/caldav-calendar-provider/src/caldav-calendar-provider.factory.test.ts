/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, it } from 'bun:test'

import { CaldavCalendarError } from './caldav-calendar-provider.error'
import { createCaldavCalendarProvider } from './caldav-calendar-provider.factory'

function buildProvider(fetchImpl: typeof fetch, overrides: { generateUid?: () => string } = {}) {
  return createCaldavCalendarProvider({
    calendarUrl: 'https://caldav.example.com/calendars/home/',
    username: 'user',
    password: 'app-password',
    fetchImpl,
    ...overrides,
  })
}

describe('createCaldavCalendarProvider', () => {
  it('rejeita calendarUrl inválida', () => {
    expect(() =>
      createCaldavCalendarProvider({ calendarUrl: 'not-a-url', username: 'user', password: 'pass' }),
    ).toThrow(CaldavCalendarError)
  })

  it('rejeita username ou password em branco', () => {
    expect(() =>
      createCaldavCalendarProvider({ calendarUrl: 'https://caldav.example.com/', username: '', password: 'pass' }),
    ).toThrow(CaldavCalendarError)
  })

  describe('upsertEvent', () => {
    it('cria evento novo com PUT usando um uid gerado', async () => {
      const requests: { method: string; url: string; auth: string; body: string }[] = []
      const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>
        requests.push({
          method: init?.method ?? '',
          url: String(url),
          auth: headers.Authorization ?? '',
          body: String(init?.body ?? ''),
        })
        return new Response(null, { status: 201 })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl, { generateUid: () => 'generated-uid' })
      const outcome = await provider.upsertEvent({
        title: 'Consulta',
        startsAt: new Date('2026-08-20T10:00:00.000Z'),
        endsAt: new Date('2026-08-20T11:00:00.000Z'),
      })

      expect(outcome).toEqual({ outcome: 'synced', externalEventId: 'generated-uid' })
      expect(requests[0]?.method).toBe('PUT')
      expect(requests[0]?.url).toBe('https://caldav.example.com/calendars/home/generated-uid.ics')
      expect(requests[0]?.auth).toBe(`Basic ${btoa('user:app-password')}`)
      expect(requests[0]?.body).toContain('UID:generated-uid')
    })

    it('reutiliza o uid existente ao atualizar um evento já sincronizado', async () => {
      const requests: string[] = []
      const fetchImpl = (async (url: RequestInfo | URL) => {
        requests.push(String(url))
        return new Response(null, { status: 204 })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const outcome = await provider.upsertEvent({
        externalCalendarId: 'existing-uid',
        title: 'Consulta remarcada',
        startsAt: new Date('2026-08-21T10:00:00.000Z'),
        endsAt: new Date('2026-08-21T11:00:00.000Z'),
      })

      expect(outcome).toEqual({ outcome: 'synced', externalEventId: 'existing-uid' })
      expect(requests[0]).toBe('https://caldav.example.com/calendars/home/existing-uid.ics')
    })

    it('devolve outcome failed quando o servidor responde erro', async () => {
      const fetchImpl = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch
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
      await provider.deleteEvent('existing-uid')

      expect(requests[0]).toEqual({
        method: 'DELETE',
        url: 'https://caldav.example.com/calendars/home/existing-uid.ics',
      })
    })

    it('trata 404 como remoção idempotente, sem lançar', async () => {
      const notFound = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
      await expect(buildProvider(notFound).deleteEvent('existing-uid')).resolves.toBeUndefined()
    })

    it('lança CaldavCalendarError para outros erros HTTP', async () => {
      const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(provider.deleteEvent('existing-uid')).rejects.toThrow(CaldavCalendarError)
    })
  })

  describe('readEvents', () => {
    it('envia REPORT calendar-query e mapeia os eventos do multistatus', async () => {
      const requests: { method: string; depth: string }[] = []
      const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>
        requests.push({ method: init?.method ?? '', depth: headers.Depth ?? '' })
        const xml = `<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR&#13;&#10;BEGIN:VEVENT&#13;&#10;UID:event-1&#13;&#10;DTSTART:20260820T100000Z&#13;&#10;DTEND:20260820T110000Z&#13;&#10;END:VEVENT&#13;&#10;END:VCALENDAR</C:calendar-data>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`
        return new Response(xml, { status: 207, headers: { 'Content-Type': 'application/xml' } })
      }) as unknown as typeof fetch

      const provider = buildProvider(fetchImpl)
      const events = await provider.readEvents({
        from: new Date('2026-08-20T00:00:00.000Z'),
        until: new Date('2026-08-21T00:00:00.000Z'),
      })

      expect(requests[0]).toEqual({ method: 'REPORT', depth: '1' })
      expect(events).toEqual([
        {
          externalEventId: 'event-1',
          startsAt: new Date('2026-08-20T10:00:00.000Z'),
          endsAt: new Date('2026-08-20T11:00:00.000Z'),
        },
      ])
    })

    it('lança CaldavCalendarError quando o servidor falha', async () => {
      const fetchImpl = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch
      const provider = buildProvider(fetchImpl)

      await expect(
        provider.readEvents({
          from: new Date('2026-08-20T00:00:00.000Z'),
          until: new Date('2026-08-21T00:00:00.000Z'),
        }),
      ).rejects.toThrow(CaldavCalendarError)
    })
  })
})
