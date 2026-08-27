/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Booking } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { BOOKING_STATUS_TONE } from './BookingStatusBadge'
import { layoutDayBookings, minutesFromDayStart, startOfDay, toVisiblePercent } from './agendaLayout.util'

export type AgendaGridProps = {
  readonly bookings: readonly Booking[]
  readonly days: readonly Date[]
  /** Instante do "agora" — recebido de fora para a linha do relógio acompanhar o tique do host. */
  readonly now: Date
  readonly onSelect?: (booking: Booking) => void
}

const HOUR_HEIGHT_REM = 4
const HEADER_CLASS =
  'sticky top-0 z-10 h-10 bg-white px-2 text-xs font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300'

function buildHours(startHour: number, endHour: number): readonly number[] {
  return Array.from({ length: endHour - startHour }, (_hour, index) => startHour + index)
}

function bookingsOnDay(bookings: readonly Booking[], day: Date, startHour: number, endHour: number): readonly Booking[] {
  const dayStart = startOfDay(day)
  const visibleStart = new Date(dayStart.getTime() + startHour * 60 * 60_000)
  const visibleEnd = new Date(dayStart.getTime() + endHour * 60 * 60_000)
  return bookings.filter((booking) => booking.startsAt < visibleEnd && booking.endsAt > visibleStart)
}

function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime()
}

export function AgendaGrid({ bookings, days, now, onSelect }: AgendaGridProps) {
  const { locale, agendaStartHour, agendaEndHour } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const hours = buildHours(agendaStartHour, agendaEndHour)
  const columnHeight = `${hours.length * HOUR_HEIGHT_REM}rem`

  return (
    <div className="flex flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="sticky left-0 z-20 flex shrink-0 flex-col border-r border-gray-200 bg-white text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        <div className={`${HEADER_CLASS} border-b border-gray-200 dark:border-gray-800`} />
        {hours.map((hour) => (
          <div key={hour} className="h-16 border-b border-gray-100 px-2 pt-1 tabular-nums dark:border-gray-800/60">
            {String(hour).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {days.map((day) => {
        const dayBookings = bookingsOnDay(bookings, day, agendaStartHour, agendaEndHour)
        const positioned = layoutDayBookings(dayBookings)
        const dayStart = startOfDay(day)
        const isToday = isSameDay(day, now)
        const nowPercent = toVisiblePercent({
          minutesSinceDayStart: minutesFromDayStart(now, dayStart),
          startHour: agendaStartHour,
          endHour: agendaEndHour,
        })
        const showNowLine = isToday && nowPercent >= 0 && nowPercent <= 100

        return (
          <div
            key={day.toISOString()}
            className={`flex-1 min-w-40 border-r border-gray-200 last:border-r-0 dark:border-gray-800 ${isToday ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''}`}
          >
            <div
              className={`${HEADER_CLASS} flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 ${isToday ? 'text-brand-700 dark:text-brand-300' : ''}`}
            >
              {day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
              {isToday && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />}
            </div>

            <div className="relative" style={{ height: columnHeight }}>
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-b border-gray-100 dark:border-gray-800/60"
                  style={{ top: `${(index / hours.length) * 100}%`, height: `${100 / hours.length}%` }}
                />
              ))}

              {positioned.length === 0 && (
                <p className="absolute inset-x-2 top-2 text-xs text-gray-400 dark:text-gray-500">
                  {messages['agenda.empty']}
                </p>
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
                const startLabel = booking.startsAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelect?.(booking)}
                    title={`${startLabel} · ${booking.title}`}
                    className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${BOOKING_STATUS_TONE[booking.status].block}`}
                    style={{
                      top: `${top}%`,
                      height: `${Math.max(bottom - top, 2)}%`,
                      left: `${columnIndex * width}%`,
                      width: `${width}%`,
                    }}
                  >
                    <span className="block font-medium tabular-nums opacity-80">{startLabel}</span>
                    <span className="block truncate">{booking.title}</span>
                  </button>
                )
              })}

              {showNowLine && (
                <div
                  aria-label={messages['agenda.now']}
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                  style={{ top: `${nowPercent}%` }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <span className="h-px flex-1 bg-red-500" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
