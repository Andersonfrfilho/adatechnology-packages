/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateResourceInput, ResourceId, UpdateResourceInput } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useCreateResource() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateResourceInput) => api.createResource(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.resources.all })
    },
  })
}

export function useUpdateResource() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { readonly id: ResourceId; readonly input: UpdateResourceInput }) =>
      api.updateResource(id, input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.resources.all })
    },
  })
}

export function useDeleteResource() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: ResourceId) => api.deleteResource(id),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.resources.all })
    },
  })
}
