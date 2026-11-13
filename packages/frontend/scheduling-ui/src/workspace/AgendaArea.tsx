/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { Booking, BookingId, ResourceId } from '@adatechnology/scheduling-contracts'

import { AgendaGrid } from '../components/AgendaGrid'
import { BookingDrawer } from '../components/BookingDrawer'
import { ResourceSelect } from '../components/ResourceSelect'
import { BlockSkeleton, EmptyState, ErrorBanner } from '../components/StateFeedback'
import { BUTTON_BASE, BUTTON_SECONDARY, FIELD_LABEL, ICON_BUTTON } from '../components/ui.constant'
import { startOfDay } from '../components/agendaLayout.util'
import { useBookings } from '../hooks/useBookings.query'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type AgendaView = 'day' | 'week'

const DAY_IN_MS = 24 * 60 * 60_000
const NOW_TICK_MS = 60_000

function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
  const start = startOfDay(date)
  const offset = (start.getDay() - weekStartsOn + 7) % 7
  return new Date(start.getTime() - offset * DAY_IN_MS)
}

function buildVisibleDays(anchorDate: Date, view: AgendaView, weekStartsOn: 0 | 1): readonly Date[] {
  if (view === 'day') return [startOfDay(anchorDate)]
  const weekStart = startOfWeek(anchorDate, weekStartsOn)
  return Array.from({ length: 7 }, (_day, index) => new Date(weekStart.getTime() + index * DAY_IN_MS))
}

function formatPeriod(days: readonly Date[], locale: string): string {
  const first = days[0] as Date
  if (days.length === 1) {
    return first.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }
  const last = days[days.length - 1] as Date
  const short: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
  return `${first.toLocaleDateString(locale, short)} – ${last.toLocaleDateString(locale, { ...short, year: 'numeric' })}`
}

/** O relógio é sistema externo: a linha de "agora" só anda se alguém a acordar. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), NOW_TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  return now
}

export function AgendaArea() {
  const { locale, weekStartsOn } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const now = useNow()
  const { data: resourcesPage } = useResources({ active: true, pageSize: MAX_PAGE_SIZE })

  const [resourceId, setResourceId] = useState<ResourceId>('')
  const [view, setView] = useState<AgendaView>('day')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedBookingId, setSelectedBookingId] = useState<BookingId | undefined>(undefined)

  const resources = resourcesPage?.data ?? []
  const days = buildVisibleDays(anchorDate, view, weekStartsOn)
  const from = days[0] as Date
  const until = new Date((days[days.length - 1] as Date).getTime() + DAY_IN_MS)

  const { data: bookingsPage, isLoading, isError } = useBookings(
    resourceId
      ? { resourceId, from, until, pageSize: MAX_PAGE_SIZE }
      : { from, until, pageSize: MAX_PAGE_SIZE },
  )

  const visibleBookings = bookingsPage?.data ?? []
  const selectedBooking = visibleBookings.find((booking) => booking.id === selectedBookingId)
  const selectedResourceTimezone = resources.find(
    (resource) => resource.id === selectedBooking?.resourceIds[0],
  )?.timezone

  function shiftAnchor(direction: -1 | 1): void {
    const step = view === 'day' ? 1 : 7
    setAnchorDate((current) => new Date(current.getTime() + direction * step * DAY_IN_MS))
  }

  function renderViewOption(value: AgendaView, label: string) {
    const isActive = view === value
    return (
      <button
        type="button"
        onClick={() => setView(value)}
        aria-pressed={isActive}
        className={`${BUTTON_BASE} flex-1 ${isActive ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-end gap-3">
          <ResourceSelect
            label={messages['agenda.resourceLabel']}
            emptyOptionLabel={messages['agenda.allResources']}
            resources={resources}
            value={resourceId}
            onChange={setResourceId}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={messages['agenda.previous']}
              onClick={() => shiftAnchor(-1)}
              className={ICON_BUTTON}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAnchorDate(new Date())} className={BUTTON_SECONDARY}>
              {messages['agenda.today']}
            </button>
            <button
              type="button"
              aria-label={messages['agenda.next']}
              onClick={() => shiftAnchor(1)}
              className={ICON_BUTTON}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <p
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 first-letter:uppercase dark:text-gray-100"
          >
            {formatPeriod(days, locale)}
          </p>

          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{messages['agenda.viewLabel']}</span>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              {renderViewOption('day', messages['agenda.viewDay'])}
              {renderViewOption('week', messages['agenda.viewWeek'])}
            </div>
          </div>
      </div>

      {isError && <ErrorBanner message={messages['common.loadFailure']} />}

      {bookingsPage && bookingsPage.total > bookingsPage.data.length && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {messages['agenda.moreResults']}
        </p>
      )}

      {isLoading && <BlockSkeleton label={messages['common.loading']} />}

      {!isLoading && !isError && visibleBookings.length === 0 && (
        <EmptyState icon={CalendarDays} title={messages['agenda.emptyTitle']} hint={messages['agenda.empty']} />
      )}

      {!isLoading && visibleBookings.length > 0 && (
        <AgendaGrid
          bookings={visibleBookings}
          days={days}
          now={now}
          onSelect={(booking: Booking) => setSelectedBookingId(booking.id)}
        />
      )}
      </div>

      {selectedBooking && (
        <BookingDrawer
          key={selectedBooking.id}
          booking={selectedBooking}
          resourceTimezone={selectedResourceTimezone}
          onClose={() => setSelectedBookingId(undefined)}
        />
      )}
    </div>
  )
}
