/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export type NotificationCalendarEvent = {
  readonly title: string
  readonly description?: string
  readonly startsAt: string | Date
  readonly endsAt?: string | Date
  readonly location?: string
  readonly url?: string
}

function toIsoDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function formatUtcCompact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
}

/**
 * Gera URL para adicionar evento no Google Calendar via web.
 */
export function generateGoogleCalendarUrl(event: NotificationCalendarEvent): string {
  const start = toIsoDate(event.startsAt)
  const end = event.endsAt ? toIsoDate(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatUtcCompact(start)}/${formatUtcCompact(end)}`,
  })

  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Gera URL para adicionar evento no Outlook Web / Live.
 */
export function generateOutlookCalendarUrl(event: NotificationCalendarEvent): string {
  const start = toIsoDate(event.startsAt)
  const end = event.endsAt ? toIsoDate(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  })

  if (event.description) params.set('body', event.description)
  if (event.location) params.set('location', event.location)

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Gera URL para adicionar evento no Microsoft 365 / Office 365 corporativo.
 */
export function generateOffice365CalendarUrl(event: NotificationCalendarEvent): string {
  const start = toIsoDate(event.startsAt)
  const end = event.endsAt ? toIsoDate(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  })

  if (event.description) params.set('body', event.description)
  if (event.location) params.set('location', event.location)

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Gera URL para adicionar evento no Yahoo Calendar.
 */
export function generateYahooCalendarUrl(event: NotificationCalendarEvent): string {
  const start = toIsoDate(event.startsAt)
  const end = event.endsAt ? toIsoDate(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const durationHours = Math.floor(durationMs / (60 * 60 * 1000))
  const durationMinutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000))
  const durStr = `${String(durationHours).padStart(2, '0')}${String(durationMinutes).padStart(2, '0')}`

  const params = new URLSearchParams({
    v: '60',
    view: 'd',
    type: '20',
    title: event.title,
    st: formatUtcCompact(start),
    dur: durStr,
  })

  if (event.description) params.set('desc', event.description)
  if (event.location) params.set('in_loc', event.location)

  return `https://calendar.yahoo.com/?${params.toString()}`
}

/**
 * Gera Data URI com o conteúdo iCalendar (.ics).
 * Permite abrir diretamente no Apple Calendar (iOS / macOS) ou disparar download no navegador.
 */
export function generateIcsDataUri(event: NotificationCalendarEvent, now = new Date()): string {
  const ics = generateIcsContent(event, now)
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}

export type CalendarLinks = {
  readonly google: string
  readonly outlook: string
  readonly office365: string
  readonly yahoo: string
  readonly icsDataUri: string
}

/**
 * Retorna todos os links de calendário disponíveis para uma notificação/evento.
 */
export function generateCalendarLinks(event: NotificationCalendarEvent): CalendarLinks {
  return {
    google: generateGoogleCalendarUrl(event),
    outlook: generateOutlookCalendarUrl(event),
    office365: generateOffice365CalendarUrl(event),
    yahoo: generateYahooCalendarUrl(event),
    icsDataUri: generateIcsDataUri(event),
  }
}

/**
 * Gera conteúdo RFC 5545 iCalendar (.ics).
 */
export function generateIcsContent(event: NotificationCalendarEvent, now = new Date()): string {
  const start = toIsoDate(event.startsAt)
  const end = event.endsAt ? toIsoDate(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  const uid = `${now.getTime()}-${Math.random().toString(36).substring(2, 9)}@adatechnology.com.br`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ada Technology//Notification Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcCompact(now)}`,
    `DTSTART:${formatUtcCompact(start)}`,
    `DTEND:${formatUtcCompact(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  }
  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Extrai metadados de evento de calendário do payload de notificação, se presente.
 */
export function extractCalendarEvent(
  payload?: Readonly<Record<string, unknown>>,
): NotificationCalendarEvent | undefined {
  if (!payload || typeof payload !== 'object') return undefined

  const raw =
    payload.calendarEvent && typeof payload.calendarEvent === 'object'
      ? (payload.calendarEvent as Record<string, unknown>)
      : payload

  const title =
    typeof raw.calendarTitle === 'string' ? raw.calendarTitle : typeof raw.title === 'string' ? raw.title : undefined

  const startsAt =
    typeof raw.calendarStartsAt === 'string'
      ? raw.calendarStartsAt
      : raw.startsAt instanceof Date || typeof raw.startsAt === 'string'
        ? raw.startsAt
        : typeof raw.activityDate === 'string'
          ? typeof raw.activityTime === 'string'
            ? `${raw.activityDate}T${raw.activityTime}:00`
            : `${raw.activityDate}T09:00:00`
          : undefined

  if (!title || !startsAt) return undefined

  const description =
    typeof raw.calendarDescription === 'string'
      ? raw.calendarDescription
      : typeof raw.description === 'string'
        ? raw.description
        : undefined

  const endsAt =
    typeof raw.calendarEndsAt === 'string'
      ? raw.calendarEndsAt
      : raw.endsAt instanceof Date || typeof raw.endsAt === 'string'
        ? raw.endsAt
        : undefined

  const location = typeof raw.location === 'string' ? raw.location : undefined
  const url = typeof raw.url === 'string' ? raw.url : undefined

  return {
    title,
    startsAt,
    ...(description ? { description } : {}),
    ...(endsAt ? { endsAt } : {}),
    ...(location ? { location } : {}),
    ...(url ? { url } : {}),
  }
}
