/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Matemática pura de calendário e fatiamento (spec §7) — nenhuma função aqui toca o banco. A
 * única conversão hora-de-parede → instante fica em `AvailabilityRepository.resolveLocalInstants`,
 * via `AT TIME ZONE` do Postgres (T3.2): é a parte que precisa de Postgres real para ser DST-safe,
 * e é a única. O resto (dia da semana, iteração de datas, corte em passos) é cálculo de
 * calendário — testável em memória, sem infraestrutura.
 */

import { LookaheadWindowTooLargeError } from '@adatechnology/scheduling-contracts'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

export type LocalDate = {
  readonly year: number
  readonly month: number
  readonly day: number
}

export type TimeWindow = {
  readonly start: Date
  readonly end: Date
}

export type AvailabilityCandidate = {
  /** Faixa mostrada ao cliente. */
  readonly during: TimeWindow
  /** `during` mais os buffers — o que é comparado contra exceção `block` e reserva existente. */
  readonly blocking: TimeWindow
}

/** Dia da semana de uma data pura — independe de fuso: calendário é o mesmo em qualquer zona. */
export function weekdayOfLocalDate(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + amount))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

export function formatLocalDate(date: LocalDate): string {
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${date.year}-${month}-${day}`
}

function localDateOf(instant: Date, timezone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year, month, day] = formatter.format(instant).split('-').map(Number)
  return { year: year!, month: month!, day: day! }
}

/**
 * Datas locais do recurso cobertas por `[from, until)`, no fuso do recurso — nunca em UTC, porque
 * a regra semanal casa com o dia da semana local (spec §5.3).
 */
export function localDateRange(params: { from: Date; until: Date; timezone: string }): LocalDate[] {
  if (params.until.getTime() <= params.from.getTime()) return []

  const start = localDateOf(params.from, params.timezone)
  const end = localDateOf(new Date(params.until.getTime() - 1), params.timezone)

  const dates: LocalDate[] = []
  let cursor = start
  while (formatLocalDate(cursor) <= formatLocalDate(end)) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

/**
 * Janela realmente bloqueada por um agendamento: `during` mais os buffers do serviço. Fonte única
 * dessa matemática (F-005) — usada tanto para desenhar o candidato de disponibilidade quanto para
 * gravar `blockingStart`/`blockingEnd` da reserva em `Booking.use-cases.ts`. Duplicar o cálculo foi
 * o que deixou os dois caminhos divergentes: o buffer "antes" só encolhia o `blocking` aqui, sem
 * nunca deslocar o `during` mostrado ao cliente — a reserva criada a partir do horário exibido
 * acabava bloqueando um intervalo diferente do que a disponibilidade tinha checado.
 */
export function computeBlockingWindow(params: {
  during: TimeWindow
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
}): TimeWindow {
  return {
    start: new Date(params.during.start.getTime() - params.bufferBeforeMinutes * 60_000),
    end: new Date(params.during.end.getTime() + params.bufferAfterMinutes * 60_000),
  }
}

/**
 * Corta `window` em candidatos de passo duração + buffers (T3.3). O `blocking` inteiro precisa
 * caber na janela, não só o `during` — assim o buffer nunca invade fora do expediente da regra, e
 * dois candidatos vizinhos nunca ficam mais próximos que o buffer exige.
 */
export function sliceIntoSteps(params: {
  window: TimeWindow
  durationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
}): AvailabilityCandidate[] {
  const bufferBeforeMs = params.bufferBeforeMinutes * 60_000
  const durationMs = params.durationMinutes * 60_000
  const stepMs = bufferBeforeMs + durationMs + params.bufferAfterMinutes * 60_000
  const endMs = params.window.end.getTime()

  const candidates: AvailabilityCandidate[] = []
  let cursorMs = params.window.start.getTime()
  while (cursorMs + stepMs <= endMs) {
    const during = {
      start: new Date(cursorMs + bufferBeforeMs),
      end: new Date(cursorMs + bufferBeforeMs + durationMs),
    }
    candidates.push({
      during,
      blocking: computeBlockingWindow({
        during,
        bufferBeforeMinutes: params.bufferBeforeMinutes,
        bufferAfterMinutes: params.bufferAfterMinutes,
      }),
    })
    cursorMs += stepMs
  }
  return candidates
}

/** Consulta de anos é varredura acidental (T3.5) — `maxLookaheadDays` vem de `SchedulingModuleConfig`. */
export function validateLookaheadWindow(params: { from: Date; until: Date; maxLookaheadDays: number }): void {
  const requestedDays = Math.ceil((params.until.getTime() - params.from.getTime()) / MILLISECONDS_PER_DAY)
  if (requestedDays > params.maxLookaheadDays) {
    throw new LookaheadWindowTooLargeError(requestedDays, params.maxLookaheadDays)
  }
}
