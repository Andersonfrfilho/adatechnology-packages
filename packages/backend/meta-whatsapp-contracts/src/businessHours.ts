/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Horário de atendimento humano: decide qual mensagem o encaminhamento manda ("já chamei alguém" ou
 * "estamos fechados, respondemos às 8h"). Não bloqueia o encaminhamento — o pedido entra na fila de
 * qualquer jeito, só a promessa feita ao cliente muda.
 */

/** 0 = domingo … 6 = sábado, como `Date.getDay()`. */
export type BusinessWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Janela de um dia, `HH:mm` no fuso de `BusinessHours.timeZone`. `end` é exclusivo. */
export type BusinessHoursWindow = {
  readonly weekday: BusinessWeekday
  readonly start: string
  readonly end: string
}

export type BusinessHours = {
  /** IANA (`America/Sao_Paulo`). */
  readonly timeZone: string
  readonly windows: readonly BusinessHoursWindow[]
  /** Datas `yyyy-mm-dd` sem atendimento (feriados), no mesmo fuso. */
  readonly closedDates?: readonly string[]
}

const WEEKDAY_BY_NAME: Readonly<Record<string, BusinessWeekday>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

type LocalMoment = { readonly date: string; readonly weekday: BusinessWeekday; readonly minutes: number }

function localMoment(now: Date, timeZone: string): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((entry) => entry.type === type)?.value ?? ''
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    weekday: WEEKDAY_BY_NAME[part('weekday')] ?? 0,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/** `true` quando `now` cai numa janela de atendimento, fora das datas fechadas. */
export function isWithinBusinessHours(hours: BusinessHours, now: Date): boolean {
  const moment = localMoment(now, hours.timeZone)
  if (hours.closedDates?.includes(moment.date)) return false
  return hours.windows.some(
    (window) =>
      window.weekday === moment.weekday &&
      moment.minutes >= toMinutes(window.start) &&
      moment.minutes < toMinutes(window.end),
  )
}
