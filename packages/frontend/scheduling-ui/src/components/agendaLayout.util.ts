/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Reservas sobrepostas dividem a largura da coluna em vez de empilhar opacas — sem isso, duas
 * reservas no mesmo horário escondem uma à outra na grade.
 */

import type { Booking } from '@adatechnology/scheduling-contracts'

export const AGENDA_START_HOUR = 7
export const AGENDA_END_HOUR = 20
export const AGENDA_VISIBLE_MINUTES = (AGENDA_END_HOUR - AGENDA_START_HOUR) * 60

export type PositionedBooking = {
  readonly booking: Booking
  readonly columnIndex: number
  readonly columnCount: number
}

function groupOverlappingBookings(sortedBookings: readonly Booking[]): readonly Booking[][] {
  const clusters: Booking[][] = []
  let current: Booking[] = []
  let currentEnd = -Infinity

  for (const booking of sortedBookings) {
    if (current.length > 0 && booking.startsAt.getTime() >= currentEnd) {
      clusters.push(current)
      current = []
      currentEnd = -Infinity
    }
    current.push(booking)
    currentEnd = Math.max(currentEnd, booking.endsAt.getTime())
  }
  if (current.length > 0) clusters.push(current)

  return clusters
}

function assignColumns(cluster: readonly Booking[]): PositionedBooking[] {
  const columnEnds: number[] = []
  const positioned: Array<{ booking: Booking; columnIndex: number }> = []

  for (const booking of cluster) {
    const freeColumnIndex = columnEnds.findIndex((end) => end <= booking.startsAt.getTime())
    const columnIndex = freeColumnIndex === -1 ? columnEnds.length : freeColumnIndex
    columnEnds[columnIndex] = booking.endsAt.getTime()
    positioned.push({ booking, columnIndex })
  }

  const columnCount = columnEnds.length
  return positioned.map((item) => ({ ...item, columnCount }))
}

export function layoutDayBookings(bookings: readonly Booking[]): readonly PositionedBooking[] {
  const sorted = [...bookings].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return groupOverlappingBookings(sorted).flatMap(assignColumns)
}

export function minutesFromDayStart(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60_000
}

export function toVisiblePercent(minutesSinceDayStart: number): number {
  const visibleMinutes = minutesSinceDayStart - AGENDA_START_HOUR * 60
  return Math.max(0, Math.min(100, (visibleMinutes / AGENDA_VISIBLE_MINUTES) * 100))
}

export function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}
