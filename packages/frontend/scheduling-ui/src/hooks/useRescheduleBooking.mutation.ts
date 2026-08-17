/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { BookingId, RescheduleBookingInput } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useRescheduleBooking() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { readonly id: BookingId; readonly input: RescheduleBookingInput }) =>
      api.rescheduleBooking(id, input),
    onSuccess(data) {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.bookings.all })
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.bookings.detail(data.id) })
    },
  })
}
