/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { CalendarEventPayload, CalendarSyncOutcome, CalendarSyncPort } from '@adatechnology/scheduling-contracts'

import { MICROSOFT_CALENDAR_ERROR_CODES, MicrosoftCalendarError } from './microsoft-calendar-provider.error'
import { validateProviderConfig } from './microsoft-calendar-provider.validation'
import type { MicrosoftCalendarProviderConfig } from './microsoft-calendar-provider.types'

const MICROSOFT_GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

type GraphDateTimeTimeZone = { readonly dateTime: string; readonly timeZone: string }

type GraphEventBody = {
  readonly subject: string
  readonly body?: { readonly contentType: 'text'; readonly content: string }
  readonly start: GraphDateTimeTimeZone
  readonly end: GraphDateTimeTimeZone
}

type GraphEventResource = {
  readonly id: string
  readonly start?: GraphDateTimeTimeZone
  readonly end?: GraphDateTimeTimeZone
}

type GraphEventListResponse = {
  readonly value?: readonly GraphEventResource[]
}

function eventsUrl(config: MicrosoftCalendarProviderConfig, eventId?: string): string {
  const calendarSegment = config.calendarId ? `/calendars/${encodeURIComponent(config.calendarId)}` : ''
  const base = `${MICROSOFT_GRAPH_API_BASE}/me${calendarSegment}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

function toGraphDateTime(date: Date): GraphDateTimeTimeZone {
  // Envia sempre com sufixo 'Z' (UTC), declarado como timeZone 'UTC' — evita conversão de
  // horário local, que o Graph exige quando o `dateTime` não carrega offset.
  return { dateTime: date.toISOString(), timeZone: 'UTC' }
}

function toGraphEventBody(payload: CalendarEventPayload): GraphEventBody {
  return {
    subject: payload.title,
    ...(payload.notes !== undefined ? { body: { contentType: 'text', content: payload.notes } } : {}),
    start: toGraphDateTime(payload.startsAt),
    end: toGraphDateTime(payload.endsAt),
  }
}

function toEventInstant(dateTimeTimeZone: GraphDateTimeTimeZone | undefined): Date {
  if (!dateTimeTimeZone) return new Date(Number.NaN)
  const { dateTime } = dateTimeTimeZone
  return new Date(dateTime.endsWith('Z') ? dateTime : `${dateTime}Z`)
}

async function requestJson(params: {
  config: MicrosoftCalendarProviderConfig
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
        Prefer: 'outlook.timezone="UTC"',
      },
      ...(params.body !== undefined ? { body: JSON.stringify(params.body) } : {}),
    })
  } catch {
    throw new MicrosoftCalendarError(MICROSOFT_CALENDAR_ERROR_CODES.unavailable, 'Microsoft Calendar is unavailable')
  }
}

export function createMicrosoftCalendarProvider(config: MicrosoftCalendarProviderConfig): CalendarSyncPort {
  validateProviderConfig(config)

  return {
    async upsertEvent(payload: CalendarEventPayload): Promise<CalendarSyncOutcome> {
      const isUpdate = Boolean(payload.externalCalendarId)
      const response = await requestJson({
        config,
        url: eventsUrl(config, payload.externalCalendarId),
        method: isUpdate ? 'PATCH' : 'POST',
        body: toGraphEventBody(payload),
      })

      if (!response.ok) {
        return {
          outcome: 'failed',
          errorCode: `http_${response.status}`,
          message: `Microsoft Graph respondeu ${response.status}`,
        }
      }

      const event = (await response.json()) as GraphEventResource
      return { outcome: 'synced', externalEventId: event.id }
    },

    async deleteEvent(externalEventId: string): Promise<void> {
      const response = await requestJson({ config, url: eventsUrl(config, externalEventId), method: 'DELETE' })
      // 404: o evento já não existe do lado do Microsoft Graph — remoção é idempotente por definição.
      if (!response.ok && response.status !== 404) {
        throw new MicrosoftCalendarError(
          MICROSOFT_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao remover evento no Microsoft Calendar (http_${response.status})`,
        )
      }
    },

    async readEvents(params: { readonly from: Date; readonly until: Date }) {
      const url = new URL(eventsUrl(config).replace('/events', '/calendarView'))
      url.searchParams.set('startDateTime', params.from.toISOString())
      url.searchParams.set('endDateTime', params.until.toISOString())

      const response = await requestJson({ config, url: url.toString(), method: 'GET' })
      if (!response.ok) {
        throw new MicrosoftCalendarError(
          MICROSOFT_CALENDAR_ERROR_CODES.unavailable,
          `Falha ao listar eventos do Microsoft Calendar (http_${response.status})`,
        )
      }

      const payload = (await response.json()) as GraphEventListResponse
      return (payload.value ?? []).map((event) => ({
        externalEventId: event.id,
        startsAt: toEventInstant(event.start),
        endsAt: toEventInstant(event.end),
      }))
    },
  }
}
