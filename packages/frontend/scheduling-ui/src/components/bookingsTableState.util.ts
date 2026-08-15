/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Ordenação, filtro e paginação vivem na URL (`web.md` §7) — sem isso, recarregar a página ou
 * compartilhar o link perde o estado da tabela.
 */

import type { Booking, BookingStatus } from '@adatechnology/scheduling-contracts'

export type BookingSortColumn = 'title' | 'status' | 'startsAt' | 'endsAt'
export type SortDirection = 'asc' | 'desc'

export type BookingsTableState = {
  readonly sortColumn?: BookingSortColumn
  readonly sortDirection: SortDirection
  readonly statusFilters: readonly BookingStatus[]
}

export const DEFAULT_BOOKINGS_TABLE_STATE: BookingsTableState = {
  sortDirection: 'asc',
  statusFilters: [],
}

const SORT_COLUMNS: readonly BookingSortColumn[] = ['title', 'status', 'startsAt', 'endsAt']

function isBookingSortColumn(value: string | null): value is BookingSortColumn {
  return SORT_COLUMNS.includes(value as BookingSortColumn)
}

export function parseBookingsTableState(search: string): BookingsTableState {
  const params = new URLSearchParams(search)
  const sortColumnParam = params.get('sortBy')
  const sortColumn = isBookingSortColumn(sortColumnParam) ? sortColumnParam : undefined
  const sortDirection: SortDirection = params.get('sortDirection') === 'desc' ? 'desc' : 'asc'
  const statusFilters = params.getAll('status') as BookingStatus[]

  return { ...(sortColumn ? { sortColumn } : {}), sortDirection, statusFilters }
}

export function serializeBookingsTableState(state: BookingsTableState): string {
  const params = new URLSearchParams()
  if (state.sortColumn) {
    params.set('sortBy', state.sortColumn)
    params.set('sortDirection', state.sortDirection)
  }
  for (const status of state.statusFilters) params.append('status', status)
  return params.toString()
}

export function isBookingsTableStateDefault(state: BookingsTableState): boolean {
  return state.sortColumn === undefined && state.statusFilters.length === 0
}

export function sortBookings(
  bookings: readonly Booking[],
  sortColumn: BookingSortColumn | undefined,
  sortDirection: SortDirection,
): readonly Booking[] {
  if (!sortColumn) return bookings
  const direction = sortDirection === 'asc' ? 1 : -1

  return [...bookings].sort((left, right) => {
    const leftValue = left[sortColumn === 'startsAt' || sortColumn === 'endsAt' ? sortColumn : sortColumn]
    const rightValue = right[sortColumn === 'startsAt' || sortColumn === 'endsAt' ? sortColumn : sortColumn]
    if (leftValue < rightValue) return -1 * direction
    if (leftValue > rightValue) return 1 * direction
    return 0
  })
}

export function filterBookingsByStatus(
  bookings: readonly Booking[],
  statusFilters: readonly BookingStatus[],
): readonly Booking[] {
  if (statusFilters.length === 0) return bookings
  return bookings.filter((booking) => statusFilters.includes(booking.status))
}
