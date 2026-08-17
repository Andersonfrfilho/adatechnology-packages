/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Booking } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { layoutDayBookings, minutesFromDayStart, startOfDay, toVisiblePercent } from './agendaLayout.util'

export type AgendaGridProps = {
  readonly bookings: readonly Booking[]
  readonly days: readonly Date[]
}

function buildHours(startHour: number, endHour: number): readonly number[] {
  return Array.from({ length: endHour - startHour }, (_hour, index) => startHour + index)
}

// H-F: filtrar pelo dia inteiro (24h) e depois grampear a posição em `toVisiblePercent` faz uma
// reserva fora da janela visível (ex.: 06:00 numa grade 07:00–20:00) desenhar encostada na
// primeira linha — indistinguível de um compromisso real às 07:00. Filtrar pela janela visível
// exclui o que não aparece nela; o que aparece parcialmente continua clampado na borda, que é a
// posição correta para um compromisso que atravessa o limite.
function bookingsOnDay(bookings: readonly Booking[], day: Date, startHour: number, endHour: number): readonly Booking[] {
  const dayStart = startOfDay(day)
  const visibleStart = new Date(dayStart.getTime() + startHour * 60 * 60_000)
  const visibleEnd = new Date(dayStart.getTime() + endHour * 60 * 60_000)
  return bookings.filter((booking) => booking.startsAt < visibleEnd && booking.endsAt > visibleStart)
}

export function AgendaGrid({ bookings, days }: AgendaGridProps) {
  const { locale, agendaStartHour, agendaEndHour } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const hours = buildHours(agendaStartHour, agendaEndHour)

  return (
    <div className="flex overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <div className="h-8" />
        {hours.map((hour) => (
          <div key={hour} className="h-16 px-2 pt-1">
            {String(hour).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {days.map((day) => {
        const dayBookings = bookingsOnDay(bookings, day, agendaStartHour, agendaEndHour)
        const positioned = layoutDayBookings(dayBookings)
        const dayStart = startOfDay(day)

        return (
          <div key={day.toISOString()} className="flex-1 min-w-[160px] border-r border-gray-200 dark:border-gray-700 last:border-r-0">
            <div className="h-8 px-2 flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              {day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </div>
            <div className="relative" style={{ height: `${hours.length * 4}rem` }}>
              {positioned.length === 0 && (
                <p className="absolute inset-x-2 top-2 text-xs text-gray-400">{messages['agenda.empty']}</p>
              )}
              {positioned.map(({ booking, columnIndex, columnCount }) => {
                const top = toVisiblePercent({
                  minutesSinceDayStart: minutesFromDayStart(booking.startsAt, dayStart),
                  startHour: agendaStartHour,
                  endHour: agendaEndHour,
                })
                const bottom = toVisiblePercent({
                  minutesSinceDayStart: minutesFromDayStart(booking.endsAt, dayStart),
                  startHour: agendaStartHour,
                  endHour: agendaEndHour,
                })
                const width = 100 / columnCount
                return (
                  <div
                    key={booking.id}
                    title={booking.title}
                    className="absolute rounded-md bg-brand-100 dark:bg-brand-900/40 border border-brand-300 dark:border-brand-700 px-1.5 py-0.5 text-xs text-brand-900 dark:text-brand-100 overflow-hidden"
                    style={{
                      top: `${top}%`,
                      height: `${Math.max(bottom - top, 2)}%`,
                      left: `${columnIndex * width}%`,
                      width: `${width}%`,
                    }}
                  >
                    {booking.title}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
