/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'
import type { ResourceId } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export function useAvailabilityRules(resourceId: ResourceId) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.availabilityRules.all(resourceId),
    queryFn: () => api.listAvailabilityRules(resourceId),
    enabled: resourceId.length > 0,
  })
}
