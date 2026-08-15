import { describe, expect, it } from 'bun:test'
import type { Booking } from '@adatechnology/scheduling-contracts'

import {
  filterBookingsByStatus,
  isBookingsTableStateDefault,
  parseBookingsTableState,
  serializeBookingsTableState,
  sortBookings,
} from './bookingsTableState.util'

function buildBooking(id: string, title: string, status: Booking['status'], startsAt: string): Booking {
  return {
    id: id as Booking['id'],
    companyId: 'company-1' as Booking['companyId'],
    title,
    status,
    startsAt: new Date(startsAt),
    endsAt: new Date(startsAt),
  }
}

describe('parseBookingsTableState / serializeBookingsTableState', () => {
  it('ida e volta preserva ordenação e filtros', () => {
    const query = serializeBookingsTableState({
      sortColumn: 'startsAt',
      sortDirection: 'desc',
      statusFilters: ['confirmed', 'requested'],
    })

    expect(parseBookingsTableState(query)).toEqual({
      sortColumn: 'startsAt',
      sortDirection: 'desc',
      statusFilters: ['confirmed', 'requested'],
    })
  })

  // Query string vinda de link colado é entrada não confiável — coluna inexistente não pode virar ordenação.
  it('ignora coluna de ordenação desconhecida', () => {
    expect(parseBookingsTableState('sortBy=lixo')).toEqual({ sortDirection: 'asc', statusFilters: [] })
  })
})

describe('isBookingsTableStateDefault', () => {
  it('é verdadeiro sem ordenação e sem filtro', () => {
    expect(isBookingsTableStateDefault({ sortDirection: 'asc', statusFilters: [] })).toBe(true)
  })

  it('é falso com qualquer filtro de status', () => {
    expect(isBookingsTableStateDefault({ sortDirection: 'asc', statusFilters: ['confirmed'] })).toBe(false)
  })
})

describe('sortBookings', () => {
  const bookings = [
    buildBooking('a', 'Zebra', 'confirmed', '2026-01-05T09:00:00'),
    buildBooking('b', 'Abacaxi', 'requested', '2026-01-05T08:00:00'),
  ]

  it('sem coluna, mantém a ordem original', () => {
    expect(sortBookings(bookings, undefined, 'asc')).toBe(bookings)
  })

  it('ordena por título ascendente', () => {
    const sorted = sortBookings(bookings, 'title', 'asc')
    expect(sorted.map((booking) => booking.title)).toEqual(['Abacaxi', 'Zebra'])
  })

  it('ordena por horário de início descendente', () => {
    const sorted = sortBookings(bookings, 'startsAt', 'desc')
    expect(sorted.map((booking) => booking.id)).toEqual(['a', 'b'])
  })
})

describe('filterBookingsByStatus', () => {
  const bookings = [
    buildBooking('a', 'A', 'confirmed', '2026-01-05T09:00:00'),
    buildBooking('b', 'B', 'cancelled', '2026-01-05T09:00:00'),
  ]

  it('sem filtro, devolve tudo', () => {
    expect(filterBookingsByStatus(bookings, [])).toBe(bookings)
  })

  it('filtra pelos status selecionados', () => {
    expect(filterBookingsByStatus(bookings, ['cancelled']).map((booking) => booking.id)).toEqual(['b'])
  })
})
