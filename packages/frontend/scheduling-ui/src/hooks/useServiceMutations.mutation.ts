/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateServiceInput, ServiceId, UpdateServiceInput } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useCreateService() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateServiceInput) => api.createService(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.services.all })
    },
  })
}

export function useUpdateService() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { readonly id: ServiceId; readonly input: UpdateServiceInput }) =>
      api.updateService(id, input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.services.all })
    },
  })
}

export function useDeleteService() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: ServiceId) => api.deleteService(id),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.services.all })
    },
  })
}
