/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { CalendarEventPayload, CalendarSyncOutcome, CalendarSyncPort } from '@adatechnology/scheduling-contracts'

import { CALDAV_CALENDAR_ERROR_CODES, CaldavCalendarError } from './caldav-calendar-provider.error'
import { buildIcsEvent, extractCalendarDataBlocks, parseIcsEvent } from './caldav-calendar-provider.ics'
import { validateProviderConfig } from './caldav-calendar-provider.validation'
import type { CaldavCalendarProviderConfig } from './caldav-calendar-provider.types'

const CALENDAR_QUERY_REPORT_BODY = (from: Date, until: Date): string => `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${toIcsInstant(from)}" end="${toIcsInstant(until)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`

function toIcsInstant(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

function eventUrl(config: CaldavCalendarProviderConfig, uid: string): string {
  return new URL(`${uid}.ics`, config.calendarUrl).toString()
}

function basicAuthHeader(config: CaldavCalendarProviderConfig): string {
  return `Basic ${btoa(`${config.username}:${config.password}`)}`
}

async function sendRequest(params: {
  config: CaldavCalendarProviderConfig
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}): Promise<Response> {
  const fetchImpl = params.config.fetchImpl ?? fetch
  try {
    return await fetchImpl(params.url, {
      method: params.method,
      headers: {
        Authorization: basicAuthHeader(params.config),
        ...params.headers,
      },
      ...(params.body !== undefined ? { body: params.body } : {}),
    })
  } catch {
    throw new CaldavCalendarError(CALDAV_CALENDAR_ERROR_CODES.unavailable, 'CalDAV server is unavailable')
  }
}

export function createCaldavCalendarProvider(config: CaldavCalendarProviderConfig): CalendarSyncPort {
  validateProviderConfig(config)
  const generateUid = config.generateUid ?? (() => crypto.randomUUID())

  return {
    async upsertEvent(payload: CalendarEventPayload): Promise<CalendarSyncOutcome> {
      const uid = payload.externalCalendarId ?? generateUid()
      const ics = buildIcsEvent({ uid, payload, stampedAt: new Date() })

      const response = await sendRequest({
        config,
        url: eventUrl(config, uid),
        method: 'PUT',
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
        body: ics,
      })

      if (!response.ok) {
        return {
          outcome: 'failed',
          errorCode: `http_${response.status}`,
          message: `Servidor CalDAV respondeu ${response.status}`,
        }
      }

      return { outcome: 'synced', externalEventId: uid }
    },

    async deleteEvent(externalEventId: string): Promise<void> {
      const response = await sendRequest({ config, url: eventUrl(config, externalEventId), method: 'DELETE' })
      // 404: o evento já não existe no servidor CalDAV — remoção é idempotente por definição.
      if (!response.ok && response.status !== 404) {
        throw new CaldavCalendarError(
          CALDAV_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao remover evento no CalDAV (http_${response.status})`,
        )
      }
    },

    async readEvents(params: { readonly from: Date; readonly until: Date }) {
      const response = await sendRequest({
        config,
        url: config.calendarUrl,
        method: 'REPORT',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: CALENDAR_QUERY_REPORT_BODY(params.from, params.until),
      })

      if (!response.ok) {
        throw new CaldavCalendarError(
          CALDAV_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao listar eventos do CalDAV (http_${response.status})`,
        )
      }

      const multistatusXml = await response.text()
      const events = extractCalendarDataBlocks(multistatusXml)
        .map((block) => parseIcsEvent(block))
        .filter((event): event is { uid: string; startsAt: Date; endsAt: Date } => event !== undefined)

      return events.map((event) => ({ externalEventId: event.uid, startsAt: event.startsAt, endsAt: event.endsAt }))
    },
  }
}
