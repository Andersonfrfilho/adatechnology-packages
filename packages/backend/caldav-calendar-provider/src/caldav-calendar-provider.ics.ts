/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { CalendarEventPayload } from '@adatechnology/scheduling-contracts'

function toIcsInstant(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcsEvent(params: { uid: string; payload: CalendarEventPayload; stampedAt: Date }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ada Technology//Scheduling//PT',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${toIcsInstant(params.stampedAt)}`,
    `DTSTART:${toIcsInstant(params.payload.startsAt)}`,
    `DTEND:${toIcsInstant(params.payload.endsAt)}`,
    `SUMMARY:${escapeIcsText(params.payload.title)}`,
  ]
  if (params.payload.notes !== undefined) lines.push(`DESCRIPTION:${escapeIcsText(params.payload.notes)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

function toDateFromIcsInstant(value: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value)
  if (!match) return new Date(Number.NaN)
  const [, year, month, day, hour, minute, second] = match
  // Sem 'Z' (hora "flutuante", sem TZID): tratada como UTC — melhor esforço sem parser de timezone completo.
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
}

function extractIcsField(icsSource: string, field: string): string | undefined {
  const match = new RegExp(`^${field}(?:;[^:\\r\\n]*)?:(.+)$`, 'm').exec(icsSource)
  return match?.[1]?.trim()
}

export function parseIcsEvent(icsSource: string): { uid: string; startsAt: Date; endsAt: Date } | undefined {
  const uid = extractIcsField(icsSource, 'UID')
  const dtstart = extractIcsField(icsSource, 'DTSTART')
  const dtend = extractIcsField(icsSource, 'DTEND')
  if (!uid || !dtstart || !dtend) return undefined
  return { uid, startsAt: toDateFromIcsInstant(dtstart), endsAt: toDateFromIcsInstant(dtend) }
}

/**
 * O REPORT calendar-query devolve XML multistatus com o ICS de cada evento embutido em
 * `calendar-data` (namespace `C:`/`cal:` varia por servidor). Um parser XML completo é peso
 * desnecessário aqui — a extração por regex cobre os servidores CalDAV testados (iCloud e
 * genéricos RFC 4791).
 */
export function extractCalendarDataBlocks(multistatusXml: string): string[] {
  const matches = multistatusXml.matchAll(/<[\w-]*:?calendar-data[^>]*>([\s\S]*?)<\/[\w-]*:?calendar-data>/gi)
  return Array.from(matches, (match) => unescapeXmlEntities(match[1] ?? ''))
}

function unescapeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCharCode(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
