/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'
import type { GetAvailabilityParams } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export type UseAvailableSlotsParams = Omit<GetAvailabilityParams, 'companyId'>

export function useAvailableSlots(params: UseAvailableSlotsParams) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.availableSlots.list(params),
    queryFn: () => api.getAvailableSlots(params),
    enabled: Boolean(params.resourceId && params.from && params.until),
  })
}
