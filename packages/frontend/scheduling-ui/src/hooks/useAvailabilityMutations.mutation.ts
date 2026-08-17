/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AvailabilityExceptionId,
  CreateAvailabilityExceptionInput,
  CreateAvailabilityRuleInput,
  ResourceId,
} from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useSetAvailabilityRules() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      resourceId,
      rules,
    }: {
      readonly resourceId: ResourceId
      readonly rules: readonly CreateAvailabilityRuleInput[]
    }) => api.setAvailabilityRules(resourceId, rules),
    onSuccess(_data, { resourceId }) {
      void queryClient.invalidateQueries({ queryKey: SCHEDULING_QUERY_KEYS.availabilityRules.all(resourceId) })
    },
  })
}

export function useAddAvailabilityException() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAvailabilityExceptionInput) => api.addAvailabilityException(input),
    onSuccess(data) {
      void queryClient.invalidateQueries({
        queryKey: SCHEDULING_QUERY_KEYS.availabilityExceptions.all(data.resourceId),
      })
    },
  })
}

export function useRemoveAvailabilityException() {
  const api = useScheduling()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { readonly id: AvailabilityExceptionId; readonly resourceId: ResourceId }) =>
      api.removeAvailabilityException(id),
    onSuccess(_data, { resourceId }) {
      void queryClient.invalidateQueries({
        queryKey: SCHEDULING_QUERY_KEYS.availabilityExceptions.all(resourceId),
      })
    },
  })
}
