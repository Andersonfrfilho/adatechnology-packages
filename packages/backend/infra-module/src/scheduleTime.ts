/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraScheduleWindowInput } from '@adatechnology/infra-contracts'

export type ZonedParts = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly minuteOfDay: number
  readonly weekday: number
}
export type MinuteWindow = { readonly on: number; readonly off: number }

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MINUTES_PER_HOUR = 60
const MS_PER_MINUTE = 60_000
const WEEKDAY_BY_NAME: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function getZonedParts(params: { readonly date: Date; readonly timezone: string }): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timezone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
  const values = new Map(formatter.formatToParts(params.date).map((part) => [part.type, part.value]))
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(values.get(type))
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    minuteOfDay: read('hour') * MINUTES_PER_HOUR + read('minute'),
    weekday: WEEKDAY_BY_NAME[values.get('weekday') ?? ''] ?? -1,
  }
}

function parseMinuteOfDay(time: string): number | undefined {
  const match = TIME_PATTERN.exec(time)
  if (match === null) return undefined
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2])
}

// Janela inválida ou invertida vira vazia: a invariante é validada fora e aqui nunca lança.
export function parseWindow(
  schedule: Pick<InfraScheduleWindowInput, 'powerOnTime' | 'powerOffTime'>,
): MinuteWindow | undefined {
  const on = parseMinuteOfDay(schedule.powerOnTime)
  const off = parseMinuteOfDay(schedule.powerOffTime)
  if (on === undefined || off === undefined || on >= off) return undefined
  return { on, off }
}

export function isInsideWindow(params: {
  readonly parts: ZonedParts
  readonly activeWeekdays: readonly number[]
  readonly window: MinuteWindow | undefined
}): boolean {
  const { parts, activeWeekdays, window } = params
  if (window === undefined || !activeWeekdays.includes(parts.weekday)) return false
  return parts.minuteOfDay >= window.on && parts.minuteOfDay < window.off
}

export function zonedTimeToInstant(params: {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly minuteOfDay: number
  readonly timezone: string
}): Date {
  const { year, month, day, minuteOfDay, timezone } = params
  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, minuteOfDay)
  const offsetAt = (instant: number): number => {
    const parts = getZonedParts({ date: new Date(instant), timezone })
    const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, parts.minuteOfDay)
    return zonedAsUtc - Math.floor(instant / MS_PER_MINUTE) * MS_PER_MINUTE
  }
  // Segunda passada com o deslocamento do instante candidato cobre viradas de horário de verão.
  const firstGuess = wallClockAsUtc - offsetAt(wallClockAsUtc)
  return new Date(wallClockAsUtc - offsetAt(firstGuess))
}
