/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { CalendarEventPayload, CalendarSyncOutcome, CalendarSyncPort } from '@adatechnology/scheduling-contracts'

import { GOOGLE_CALENDAR_ERROR_CODES, GoogleCalendarError } from './google-calendar-provider.error'
import { validateProviderConfig } from './google-calendar-provider.validation'
import type { GoogleCalendarProviderConfig } from './google-calendar-provider.types'

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

type GoogleEventDateTime = { readonly dateTime?: string; readonly date?: string }

type GoogleEventBody = {
  readonly summary: string
  readonly description?: string
  readonly start: GoogleEventDateTime
  readonly end: GoogleEventDateTime
}

type GoogleEventResource = {
  readonly id: string
  readonly start?: GoogleEventDateTime
  readonly end?: GoogleEventDateTime
}

type GoogleEventListResponse = {
  readonly items?: readonly GoogleEventResource[]
}

function classifyHttpError(status: number): { errorCode: string } {
  if (status === 429 || status >= 500) return { errorCode: `http_${status}` }
  if (status === 401 || status === 403) return { errorCode: `http_${status}` }
  return { errorCode: `http_${status}` }
}

function eventsUrl(config: GoogleCalendarProviderConfig, eventId?: string): string {
  const base = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(config.calendarId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

function toGoogleEventBody(payload: CalendarEventPayload): GoogleEventBody {
  return {
    summary: payload.title,
    ...(payload.notes !== undefined ? { description: payload.notes } : {}),
    start: { dateTime: payload.startsAt.toISOString() },
    end: { dateTime: payload.endsAt.toISOString() },
  }
}

function toEventInstant(dateTime: GoogleEventDateTime | undefined): Date {
  const value = dateTime?.dateTime ?? dateTime?.date
  return value ? new Date(value) : new Date(Number.NaN)
}

async function requestJson(params: {
  config: GoogleCalendarProviderConfig
  url: string
  method: string
  body?: unknown
}): Promise<Response> {
  const fetchImpl = params.config.fetchImpl ?? fetch
  const accessToken = await params.config.getAccessToken()

  try {
    return await fetchImpl(params.url, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
    })
  } catch {
    throw new GoogleCalendarError(GOOGLE_CALENDAR_ERROR_CODES.unavailable, 'Google Calendar is unavailable')
  }
}

export function createGoogleCalendarProvider(config: GoogleCalendarProviderConfig): CalendarSyncPort {
  validateProviderConfig(config)

  return {
    async upsertEvent(payload: CalendarEventPayload): Promise<CalendarSyncOutcome> {
      const isUpdate = Boolean(payload.externalCalendarId)
      const response = await requestJson({
        config,
        url: eventsUrl(config, payload.externalCalendarId),
        method: isUpdate ? 'PATCH' : 'POST',
        body: toGoogleEventBody(payload),
      })

      if (!response.ok) {
        const { errorCode } = classifyHttpError(response.status)
        return { outcome: 'failed', errorCode, message: `Google Calendar respondeu ${response.status}` }
      }

      const event = (await response.json()) as GoogleEventResource
      return { outcome: 'synced', externalEventId: event.id }
    },

    async deleteEvent(externalEventId: string): Promise<void> {
      const response = await requestJson({ config, url: eventsUrl(config, externalEventId), method: 'DELETE' })
      // 404/410: o evento já não existe do lado do Google — remoção é idempotente por definição.
      if (!response.ok && response.status !== 404 && response.status !== 410) {
        const { errorCode } = classifyHttpError(response.status)
        throw new GoogleCalendarError(
          GOOGLE_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao remover evento no Google Calendar (${errorCode})`,
        )
      }
    },

    async readEvents(params: { readonly from: Date; readonly until: Date }) {
      const url = new URL(eventsUrl(config))
      url.searchParams.set('timeMin', params.from.toISOString())
      url.searchParams.set('timeMax', params.until.toISOString())
      url.searchParams.set('singleEvents', 'true')

      const response = await requestJson({ config, url: url.toString(), method: 'GET' })
      if (!response.ok) {
        throw new GoogleCalendarError(
          GOOGLE_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao listar eventos do Google Calendar (${response.status})`,
        )
      }

      const payload = (await response.json()) as GoogleEventListResponse
      return (payload.items ?? []).map((event) => ({
        externalEventId: event.id,
        startsAt: toEventInstant(event.start),
        endsAt: toEventInstant(event.end),
      }))
    },
  }
}
