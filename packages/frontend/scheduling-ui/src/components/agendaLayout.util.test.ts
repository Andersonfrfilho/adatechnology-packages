import { describe, expect, it } from 'bun:test'
import type { Booking } from '@adatechnology/scheduling-contracts'

import { layoutDayBookings, minutesFromDayStart, startOfDay, toVisiblePercent } from './agendaLayout.util'

function buildBooking(id: string, startsAt: string, endsAt: string): Booking {
  return {
    id: id as Booking['id'],
    companyId: 'company-1' as Booking['companyId'],
    title: id,
    status: 'confirmed',
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
  }
}

describe('layoutDayBookings', () => {
  it('mantém uma coluna quando não há sobreposição', () => {
    const bookings = [
      buildBooking('a', '2026-01-05T09:00:00', '2026-01-05T10:00:00'),
      buildBooking('b', '2026-01-05T10:00:00', '2026-01-05T11:00:00'),
    ]

    const positioned = layoutDayBookings(bookings)

    expect(positioned.every((item) => item.columnCount === 1 && item.columnIndex === 0)).toBe(true)
  })

  it('divide reservas sobrepostas em colunas lado a lado', () => {
    const bookings = [
      buildBooking('a', '2026-01-05T09:00:00', '2026-01-05T10:00:00'),
      buildBooking('b', '2026-01-05T09:30:00', '2026-01-05T10:30:00'),
    ]

    const positioned = layoutDayBookings(bookings)
    const byId = Object.fromEntries(positioned.map((item) => [item.booking.id, item]))

    expect(byId.a?.columnCount).toBe(2)
    expect(byId.b?.columnCount).toBe(2)
    expect(byId.a?.columnIndex).not.toBe(byId.b?.columnIndex)
  })

  // A terceira reserva reaproveita a coluna liberada pela primeira em vez de abrir uma terceira.
  it('reaproveita coluna liberada por uma reserva já encerrada', () => {
    const bookings = [
      buildBooking('a', '2026-01-05T09:00:00', '2026-01-05T10:00:00'),
      buildBooking('b', '2026-01-05T09:30:00', '2026-01-05T10:30:00'),
      buildBooking('c', '2026-01-05T10:00:00', '2026-01-05T11:00:00'),
    ]

    const positioned = layoutDayBookings(bookings)
    const byId = Object.fromEntries(positioned.map((item) => [item.booking.id, item]))

    expect(byId.a?.columnCount).toBe(2)
    expect(byId.c?.columnIndex).toBe(byId.a?.columnIndex)
  })
})

describe('toVisiblePercent', () => {
  it('limita o resultado entre 0 e 100', () => {
    expect(toVisiblePercent(-1000)).toBe(0)
    expect(toVisiblePercent(1_000_000)).toBe(100)
  })
})

describe('startOfDay', () => {
  it('zera a hora, mantendo a data', () => {
    expect(startOfDay(new Date('2026-01-05T15:30:00'))).toEqual(new Date('2026-01-05T00:00:00'))
  })
})

describe('minutesFromDayStart', () => {
  it('calcula os minutos desde o início do dia', () => {
    const day = startOfDay(new Date('2026-01-05T15:30:00'))
    expect(minutesFromDayStart(new Date('2026-01-05T16:00:00'), day)).toBe(960)
  })
})
