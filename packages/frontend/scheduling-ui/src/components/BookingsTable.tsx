/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { BOOKING_STATUS } from '@adatechnology/scheduling-contracts'
import type { Booking, BookingId, BookingStatus } from '@adatechnology/scheduling-contracts'

import { useSchedulingConfig } from '../providers/SchedulingProvider'
import { resolveSchedulingMessages } from '../locales'
import { BookingStatusBadge, bookingStatusLabel } from './BookingStatusBadge'
import { BUTTON_PRIMARY, ICON_BUTTON, ROW_STRIPE, SURFACE_BORDER } from './ui.constant'
import {
  DEFAULT_BOOKINGS_TABLE_STATE,
  filterBookingsByStatus,
  isBookingsTableStateDefault,
} from './bookingsTableState.util'
import type { BookingSortColumn, BookingsTableState } from './bookingsTableState.util'

export type BookingsTableBulkAction = {
  readonly key: string
  readonly label: string
  readonly onRun: (selectedIds: readonly BookingId[]) => void
}

export type BookingsTablePagination = {
  readonly totalPages: number
}

export type BookingsTableProps = {
  readonly bookings: readonly Booking[]
  readonly state?: BookingsTableState
  readonly onStateChange?: (state: BookingsTableState) => void
  readonly pagination?: BookingsTablePagination
  readonly onRowClick?: (booking: Booking) => void
  readonly bulkActions?: readonly BookingsTableBulkAction[]
}

const ALL_STATUSES = Object.values(BOOKING_STATUS)

const HEADER_BUTTON_CLASS =
  'inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'
const CHECKBOX_CELL_CLASS = 'px-3 py-2'

// L-007: sem estado neutro o clique nunca solta a coluna — cicla asc → desc → sem ordenação.
function nextSortState(
  column: BookingSortColumn,
  currentColumn: BookingSortColumn | undefined,
  currentDirection: 'asc' | 'desc',
): { sortColumn: BookingSortColumn | undefined; sortDirection: 'asc' | 'desc' } {
  if (currentColumn !== column) return { sortColumn: column, sortDirection: 'asc' }
  if (currentDirection === 'asc') return { sortColumn: column, sortDirection: 'desc' }
  return { sortColumn: undefined, sortDirection: 'asc' }
}

export function BookingsTable({
  bookings,
  state = DEFAULT_BOOKINGS_TABLE_STATE,
  onStateChange,
  pagination,
  onRowClick,
  bulkActions = [],
}: BookingsTableProps) {
  const { locale } = useSchedulingConfig()
  const messages = resolveSchedulingMessages(locale)
  const [selected, setSelected] = useState<ReadonlySet<BookingId>>(new Set())

  // H-2/H-F: ordenação e filtro de status múltiplo já acontecem no servidor (`BookingsArea`
  // repassa `sortBy`/`sortDirection`/`status[]`) — este filtro é só rede de segurança para quem
  // consome `BookingsTable` direto, com dados que não passaram por `BookingsArea`.
  const visibleBookings = filterBookingsByStatus(bookings, state.statusFilters)
  const allSelected = visibleBookings.length > 0 && visibleBookings.every((booking) => selected.has(booking.id))

  function toggleSort(column: BookingSortColumn): void {
    onStateChange?.({
      ...state,
      ...nextSortState(column, state.sortColumn, state.sortDirection),
    })
  }

  // Trocar o filtro muda o conjunto de reservas atrás da paginação — manter a página atual
  // arrisca cair numa página vazia ou fora do novo total.
  function toggleStatusFilter(status: BookingStatus): void {
    const isActive = state.statusFilters.includes(status)
    onStateChange?.({
      ...state,
      statusFilters: isActive
        ? state.statusFilters.filter((filterStatus) => filterStatus !== status)
        : [...state.statusFilters, status],
      page: 1,
    })
  }

  function goToPage(page: number): void {
    onStateChange?.({ ...state, page })
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
    const ariaSort: 'ascending' | 'descending' | 'none' =
      state.sortColumn !== column ? 'none' : state.sortDirection === 'asc' ? 'ascending' : 'descending'
    return (
      <th scope="col" className="px-3 py-2" aria-sort={ariaSort}>
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
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">{messages['booking.filterByStatus']}</legend>
          {ALL_STATUSES.map((status) => {
            const isActive = state.statusFilters.includes(status)
            return (
              <label
                key={status}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isActive}
                  onChange={() => toggleStatusFilter(status)}
                />
                {bookingStatusLabel(messages, status)}
              </label>
            )
          })}
        </fieldset>
        {!isBookingsTableStateDefault(state) && (
          <button
            type="button"
            onClick={() => onStateChange?.(DEFAULT_BOOKINGS_TABLE_STATE)}
            className="min-h-11 px-3 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
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
              className={BUTTON_PRIMARY}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className={`${SURFACE_BORDER} overflow-x-auto`}>
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
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
                className={`${index % 2 === 1 ? ROW_STRIPE : ''} hover:bg-brand-50/50 dark:hover:bg-brand-900/10`}
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
                  <BookingStatusBadge status={booking.status} />
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{booking.startsAt.toLocaleString(locale)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{booking.endsAt.toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleBookings.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{messages['common.empty']}</p>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            aria-label={messages['common.previousPage']}
            disabled={state.page <= 1}
            onClick={() => goToPage(state.page - 1)}
            className={ICON_BUTTON}
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          </button>
          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
            {state.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            aria-label={messages['common.nextPage']}
            disabled={state.page >= pagination.totalPages}
            onClick={() => goToPage(state.page + 1)}
            className={ICON_BUTTON}
          >
            <ArrowRight aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
