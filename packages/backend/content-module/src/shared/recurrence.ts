/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Datas da recorrência, sempre em UTC: o instante de cada execução não depende do fuso do servidor.
 */

import { RECURRENCE_FREQUENCY, type RecurrenceFrequency } from '@adatechnology/content-contracts'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/** Mensal no dia 31 cai em 28/29/30 nos meses curtos e VOLTA ao 31 depois (o âncora não deriva). */
function addMonths(from: Date, anchorDay: number, months: number): Date {
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1))
  const day = Math.min(anchorDay, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()))
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  )
}

export function nextOccurrence(params: { frequency: RecurrenceFrequency; from: Date; anchorDay: number }): Date {
  if (params.frequency === RECURRENCE_FREQUENCY.WEEKLY) return new Date(params.from.getTime() + WEEK_MS)
  return addMonths(params.from, params.anchorDay, 1)
}

/**
 * Primeira ocorrência estritamente depois de `now`. Servidor parado três semanas publica UM post ao
 * voltar, não três: as ocorrências perdidas são puladas, nunca emitidas em rajada.
 */
export function nextOccurrenceAfter(params: {
  frequency: RecurrenceFrequency
  from: Date
  anchorDay: number
  now: Date
}): Date {
  let candidate = nextOccurrence(params)
  while (candidate <= params.now) candidate = nextOccurrence({ ...params, from: candidate })
  return candidate
}

export function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10)
}
