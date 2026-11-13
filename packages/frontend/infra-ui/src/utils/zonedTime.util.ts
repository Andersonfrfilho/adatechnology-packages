/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_TIME_ZONE, MILLISECONDS_PER_DAY } from '../constants/infraUi.constant'

export type ZonedParts = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
  readonly weekday: number
}

const ZONED_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: INFRA_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function readPart(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0)
}

export function getZonedParts(date: Date): ZonedParts {
  const parts = ZONED_FORMATTER.formatToParts(date)
  const year = readPart(parts, 'year')
  const month = readPart(parts, 'month')
  const day = readPart(parts, 'day')

  return {
    year,
    month,
    day,
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
    second: readPart(parts, 'second'),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

/** Numero de dias de calendario entre `from` e `to` no fuso da infra (positivo quando `to` e depois). */
export function calendarDaysBetween({ from, to }: { readonly from: Date; readonly to: Date }): number {
  const fromParts = getZonedParts(from)
  const toParts = getZonedParts(to)
  const fromDay = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)
  const toDay = Date.UTC(toParts.year, toParts.month - 1, toParts.day)

  return Math.round((toDay - fromDay) / MILLISECONDS_PER_DAY)
}

/** Meia-noite local que encerra o dia de `date`. O Brasil nao tem horario de verao, entao o deslocamento do dia e constante. */
export function getEndOfZonedDay(date: Date): Date {
  const parts = getZonedParts(date)
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const offsetMs = localAsUtc - Math.floor(date.getTime() / 1000) * 1000
  const nextMidnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day + 1, 0, 0, 0)

  return new Date(nextMidnightAsUtc - offsetMs)
}

export function formatZonedTime(date: Date): string {
  const parts = getZonedParts(date)

  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

/** Troca `{chave}` pelos valores; o texto vive no locale e o valor so entra aqui. */
export function fillTemplate({
  template,
  values,
}: {
  readonly template: string
  readonly values: Readonly<Record<string, string>>
}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] ?? placeholder)
}
