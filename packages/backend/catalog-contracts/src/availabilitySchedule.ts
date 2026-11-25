/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Janela de disponibilidade de um produto: dias da semana e, opcionalmente, um intervalo de
 * horário, avaliados num fuso. É genérica de propósito — serve a item vendido só em certos dias e
 * horas, a pacote sazonal, a serviço com expediente. Função pura e sem dependência: roda igual no
 * servidor e no navegador.
 */

import { z } from 'zod'

/** 0 = domingo … 6 = sábado, a mesma convenção de `Date#getDay`. */
export const WEEKDAY = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const
export type Weekday = (typeof WEEKDAY)[keyof typeof WEEKDAY]

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export const DEFAULT_SCHEDULE_TIME_ZONE = 'UTC'

const MINUTES_PER_DAY = 1440
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export type AvailabilitySchedule = {
  /** Dias em que o produto está à venda. Vazio nunca é válido: produto sem dia é produto pausado. */
  readonly weekdays: readonly Weekday[]
  /** `HH:mm` (24h), inclusivo. Ausente = desde o início do dia. */
  readonly from?: string
  /**
   * `HH:mm` (24h), exclusivo. Ausente = até o fim do dia. Menor que `from` = janela que vira a
   * madrugada: o dia da semana é o do **início** da janela.
   */
  readonly until?: string
  /** Fuso IANA (`America/Sao_Paulo`). Ausente = o padrão do módulo, e na falta dele UTC. */
  readonly timeZone?: string
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

const timeOfDay = z.string().regex(TIME_PATTERN, 'Use o formato HH:mm')

export const availabilityScheduleSchema = z
  .object({
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, 'Dias repetidos'),
    from: timeOfDay.optional(),
    until: timeOfDay.optional(),
    timeZone: z.string().min(1).max(64).refine(isValidTimeZone, 'Fuso horário desconhecido').optional(),
  })
  .refine((schedule) => schedule.from === undefined || schedule.from !== schedule.until, {
    message: 'from e until não podem ser iguais',
    path: ['until'],
  })

function toMinutes(time: string | undefined, fallback: number): number {
  if (time === undefined) return fallback
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

const WEEKDAY_BY_SHORT_NAME: Readonly<Record<string, Weekday>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Dia da semana e minuto do dia de um instante, vistos no fuso — não no do servidor. */
export function localTimeParts(params: { readonly at: Date; readonly timeZone: string }): {
  readonly weekday: Weekday
  readonly minutes: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: params.timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(params.at)

  const read = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  return {
    weekday: WEEKDAY_BY_SHORT_NAME[read('weekday')] ?? 0,
    minutes: Number(read('hour')) * 60 + Number(read('minute')),
  }
}

/**
 * `schedule` ausente ou `null` = sem restrição, sempre disponível. O fuso do próprio horário
 * vence o `defaultTimeZone`, que vence UTC.
 */
export function isAvailableAt(params: {
  readonly schedule: AvailabilitySchedule | null | undefined
  readonly at: Date
  readonly defaultTimeZone?: string
}): boolean {
  const { schedule } = params
  if (!schedule) return true

  const timeZone = schedule.timeZone ?? params.defaultTimeZone ?? DEFAULT_SCHEDULE_TIME_ZONE
  const { weekday, minutes } = localTimeParts({ at: params.at, timeZone })
  const from = toMinutes(schedule.from, 0)
  const until = toMinutes(schedule.until, MINUTES_PER_DAY)
  const isDayEnabled = (day: number): boolean => schedule.weekdays.includes(day as Weekday)

  if (from < until) return isDayEnabled(weekday) && minutes >= from && minutes < until

  // Janela que cruza a meia-noite: a parte depois de `from` pertence ao dia de hoje, e a parte
  // antes de `until` é a cauda da janela que começou ontem.
  const yesterday = (weekday + 6) % 7
  return (isDayEnabled(weekday) && minutes >= from) || (isDayEnabled(yesterday) && minutes < until)
}
