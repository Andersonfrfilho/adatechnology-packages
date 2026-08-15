/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { BOOKING_STATUS } from '@adatechnology/scheduling-contracts'
import type { Booking, BookingId, BookingStatus } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { useBookingsTableState } from '../hooks/useBookingsTableState.hook'
import {
  filterBookingsByStatus,
  isBookingsTableStateDefault,
  sortBookings,
} from './bookingsTableState.util'
import type { BookingSortColumn } from './bookingsTableState.util'

export type BookingsTableBulkAction = {
  readonly key: string
  readonly label: string
  readonly onRun: (selectedIds: readonly BookingId[]) => void
}

export type BookingsTableProps = {
  readonly bookings: readonly Booking[]
  readonly onRowClick?: (booking: Booking) => void
  readonly bulkActions?: readonly BookingsTableBulkAction[]
}

const ALL_STATUSES = Object.values(BOOKING_STATUS)

const HEADER_BUTTON_CLASS =
  'inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'
const CHECKBOX_CELL_CLASS = 'px-3 py-2'

function nextSortDirection(
  column: BookingSortColumn,
  currentColumn: BookingSortColumn | undefined,
  currentDirection: 'asc' | 'desc',
): 'asc' | 'desc' {
  if (currentColumn !== column) return 'asc'
  return currentDirection === 'asc' ? 'desc' : 'asc'
}

export function BookingsTable({ bookings, onRowClick, bulkActions = [] }: BookingsTableProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const [state, setState] = useBookingsTableState()
  const [selected, setSelected] = useState<ReadonlySet<BookingId>>(new Set())

  const filtered = filterBookingsByStatus(bookings, state.statusFilters)
  const visibleBookings = sortBookings(filtered, state.sortColumn, state.sortDirection)
  const allSelected = visibleBookings.length > 0 && visibleBookings.every((booking) => selected.has(booking.id))

  function toggleSort(column: BookingSortColumn): void {
    setState({
      ...state,
      sortColumn: column,
      sortDirection: nextSortDirection(column, state.sortColumn, state.sortDirection),
    })
  }

  function toggleStatusFilter(status: BookingStatus): void {
    const isActive = state.statusFilters.includes(status)
    setState({
      ...state,
      statusFilters: isActive
        ? state.statusFilters.filter((filterStatus) => filterStatus !== status)
        : [...state.statusFilters, status],
    })
  }

  function toggleSelectAll(): void {
    setSelected(allSelected ? new Set() : new Set(visibleBookings.map((booking) => booking.id)))
  }

  function toggleRowSelected(id: BookingId): void {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function renderSortIcon(column: BookingSortColumn) {
    if (state.sortColumn !== column) return <ArrowUpDown aria-hidden="true" className="w-3 h-3" />
    return state.sortDirection === 'asc' ? (
      <ArrowUp aria-hidden="true" className="w-3 h-3" />
    ) : (
      <ArrowDown aria-hidden="true" className="w-3 h-3" />
    )
  }

  function renderHeader(column: BookingSortColumn, labelKey: 'booking.column.title' | 'booking.column.status' | 'booking.column.startsAt' | 'booking.column.endsAt') {
    return (
      <th scope="col" className="px-3 py-2">
        <button type="button" onClick={() => toggleSort(column)} className={HEADER_BUTTON_CLASS}>
          {messages[labelKey]}
          {renderSortIcon(column)}
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {ALL_STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-1.5 text-sm min-h-11">
            <input
              type="checkbox"
              checked={state.statusFilters.includes(status)}
              onChange={() => toggleStatusFilter(status)}
            />
            {messages[`booking.status.${status === 'no_show' ? 'noShow' : status}` as keyof typeof messages]}
          </label>
        ))}
        {!isBookingsTableStateDefault(state) && (
          <button
            type="button"
            onClick={() => setState({ sortDirection: 'asc', statusFilters: [] })}
            className="min-h-11 px-3 text-sm font-medium text-brand-700 hover:underline"
          >
            {messages['common.clearFilters']}
          </button>
        )}
      </div>

      {selected.size > 0 && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 px-3 py-2">
          {bulkActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => action.onRun(Array.from(selected))}
              className="min-h-11 px-3 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th scope="col" className={CHECKBOX_CELL_CLASS}>
                <input
                  type="checkbox"
                  aria-label={messages['common.selectAll']}
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              {renderHeader('title', 'booking.column.title')}
              {renderHeader('status', 'booking.column.status')}
              {renderHeader('startsAt', 'booking.column.startsAt')}
              {renderHeader('endsAt', 'booking.column.endsAt')}
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking, index) => (
              <tr
                key={booking.id}
                className={index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : undefined}
              >
                <td className={CHECKBOX_CELL_CLASS}>
                  <input
                    type="checkbox"
                    aria-label={booking.title}
                    checked={selected.has(booking.id)}
                    onChange={() => toggleRowSelected(booking.id)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onRowClick?.(booking)} className="min-h-11 text-left hover:underline">
                    {booking.title}
                  </button>
                </td>
                <td className="px-3 py-2">
                  {messages[`booking.status.${booking.status === 'no_show' ? 'noShow' : booking.status}` as keyof typeof messages]}
                </td>
                <td className="px-3 py-2">{booking.startsAt.toLocaleString(locale)}</td>
                <td className="px-3 py-2">{booking.endsAt.toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleBookings.length === 0 && (
          <p className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{messages['common.empty']}</p>
        )}
      </div>
    </div>
  )
}
