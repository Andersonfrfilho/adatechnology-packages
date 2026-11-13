/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'
import type { BookingId, ListBookingsParams } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export type UseBookingsParams = Omit<ListBookingsParams, 'companyId'>

export function useBookings(params: UseBookingsParams = {}) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.bookings.list(params),
    queryFn: () => api.listBookings(params),
  })
}

export function useBooking(id: BookingId) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.bookings.detail(id),
    queryFn: () => api.getBooking(id),
    enabled: id.length > 0,
  })
}
