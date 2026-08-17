/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A chave de idempotência é gerada aqui, não no host: o retry de rede da própria mutação
 * (TanStack Query) precisa reenviar a mesma chave, e gerar no `mutationFn` a cada chamada criaria
 * uma reserva duplicada por retry — o mesmo risco que `apis.md` "Idempotency" descreve para POST.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RequestBookingInput } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useRequestBooking() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { readonly input: RequestBookingInput; readonly idempotencyKey: string }) =>
      api.requestBooking(input, idempotencyKey),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.bookings.all })
      void queryClient.invalidateQueries({ queryKey: ['scheduling', 'available-slots'] })
    },
  })
}
