/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Booking, BookingId, CancelBookingInput } from '@adatechnology/scheduling-contracts'
import type { UseMutationResult } from '@tanstack/react-query'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

function invalidateBooking(queryClient: ReturnType<typeof useQueryClient>, booking: Booking): void {
  void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.bookings.all })
  void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.bookings.detail(booking.id) })
}

export function useConfirmBooking(): UseMutationResult<Booking, Error, BookingId> {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: BookingId) => api.confirmBooking(id),
    onSuccess: (booking) => invalidateBooking(queryClient, booking),
  })
}

export function useCancelBooking() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { readonly id: BookingId; readonly input: CancelBookingInput }) =>
      api.cancelBooking(id, input),
    onSuccess: (booking) => invalidateBooking(queryClient, booking),
  })
}

export function useCompleteBooking(): UseMutationResult<Booking, Error, BookingId> {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: BookingId) => api.completeBooking(id),
    onSuccess: (booking) => invalidateBooking(queryClient, booking),
  })
}

export function useMarkNoShow(): UseMutationResult<Booking, Error, BookingId> {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: BookingId) => api.markNoShow(id),
    onSuccess: (booking) => invalidateBooking(queryClient, booking),
  })
}
