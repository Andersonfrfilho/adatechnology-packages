/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Booking } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  layoutDayBookings,
  minutesFromDayStart,
  startOfDay,
  toVisiblePercent,
} from './agendaLayout.util'

export type AgendaGridProps = {
  readonly bookings: readonly Booking[]
  readonly days: readonly Date[]
}

const HOURS = Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR }, (_hour, index) => AGENDA_START_HOUR + index)

function bookingsOnDay(bookings: readonly Booking[], day: Date): readonly Booking[] {
  const dayStart = startOfDay(day)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000)
  return bookings.filter((booking) => booking.startsAt < dayEnd && booking.endsAt > dayStart)
}

export function AgendaGrid({ bookings, days }: AgendaGridProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)

  return (
    <div className="flex overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <div className="h-8" />
        {HOURS.map((hour) => (
          <div key={hour} className="h-16 px-2 pt-1">
            {String(hour).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {days.map((day) => {
        const dayBookings = bookingsOnDay(bookings, day)
        const positioned = layoutDayBookings(dayBookings)
        const dayStart = startOfDay(day)

        return (
          <div key={day.toISOString()} className="flex-1 min-w-[160px] border-r border-gray-200 dark:border-gray-700 last:border-r-0">
            <div className="h-8 px-2 flex items-center text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              {day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </div>
            <div className="relative" style={{ height: `${HOURS.length * 4}rem` }}>
              {positioned.length === 0 && (
                <p className="absolute inset-x-2 top-2 text-xs text-gray-400">{messages['agenda.empty']}</p>
              )}
              {positioned.map(({ booking, columnIndex, columnCount }) => {
                const top = toVisiblePercent(minutesFromDayStart(booking.startsAt, dayStart))
                const bottom = toVisiblePercent(minutesFromDayStart(booking.endsAt, dayStart))
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
