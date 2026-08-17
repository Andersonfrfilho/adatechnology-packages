/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useState } from 'react'
import { MAX_PAGE_SIZE } from '@adatechnology/scheduling-contracts'
import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { AgendaGrid } from '../components/AgendaGrid'
import { startOfDay } from '../components/agendaLayout.util'
import { useBookings } from '../hooks/useBookings.query'
import { useResources } from '../hooks/useResources.query'
import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'

type AgendaView = 'day' | 'week'

const DAY_IN_MS = 24 * 60 * 60_000

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

const NAV_BUTTON_CLASS =
  'min-h-11 px-3 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'

export function AgendaArea() {
  const { locale, weekStartsOn } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  // H-3: sem `pageSize`, o padrão de 20 corta a lista de recursos e a de reservas da semana no
  // mesmo teto — `MAX_PAGE_SIZE` é o maior lote que o contrato aceita numa única página.
  const { data: resourcesPage } = useResources({ active: true, pageSize: MAX_PAGE_SIZE })

  const [resourceId, setResourceId] = useState<ResourceId>('')
  const [view, setView] = useState<AgendaView>('day')
  const [anchorDate, setAnchorDate] = useState(() => new Date())

  const resources = resourcesPage?.data ?? []
  const days = buildVisibleDays(anchorDate, view, weekStartsOn)
  const from = days[0] as Date
  const until = new Date((days[days.length - 1] as Date).getTime() + DAY_IN_MS)

  const { data: bookingsPage, isLoading, isError } = useBookings(
    resourceId
      ? { resourceId, from, until, pageSize: MAX_PAGE_SIZE }
      : { from, until, pageSize: MAX_PAGE_SIZE },
  )

  function shiftAnchor(days_: number): void {
    setAnchorDate((current) => new Date(current.getTime() + days_ * DAY_IN_MS))
  }

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">{messages['agenda.resourceLabel']}</span>
          <select
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
            className="min-h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-sm"
          >
            <option value="">—</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={() => shiftAnchor(view === 'day' ? -1 : -7)} className={NAV_BUTTON_CLASS}>
            {messages['agenda.previous']}
          </button>
          <button type="button" onClick={() => setAnchorDate(new Date())} className={NAV_BUTTON_CLASS}>
            {messages['agenda.today']}
          </button>
          <button type="button" onClick={() => shiftAnchor(view === 'day' ? 1 : 7)} className={NAV_BUTTON_CLASS}>
            {messages['agenda.next']}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView('day')}
            aria-current={view === 'day' ? 'true' : undefined}
            className={`${NAV_BUTTON_CLASS} ${view === 'day' ? 'bg-brand-600 text-white border-brand-600' : ''}`}
          >
            {messages['agenda.viewDay']}
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            aria-current={view === 'week' ? 'true' : undefined}
            className={`${NAV_BUTTON_CLASS} ${view === 'week' ? 'bg-brand-600 text-white border-brand-600' : ''}`}
          >
            {messages['agenda.viewWeek']}
          </button>
        </div>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {messages['common.loadFailure']}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{messages['common.loading']}</p>
      ) : (
        <AgendaGrid bookings={bookingsPage?.data ?? []} days={days} />
      )}
    </div>
  )
}
