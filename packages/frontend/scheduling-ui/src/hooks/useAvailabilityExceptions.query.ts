/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'
import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useAvailabilityExceptions(resourceId: ResourceId) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.availabilityExceptions.all(resourceId),
    queryFn: () => api.listAvailabilityExceptions(resourceId),
    enabled: resourceId.length > 0,
  })
}
