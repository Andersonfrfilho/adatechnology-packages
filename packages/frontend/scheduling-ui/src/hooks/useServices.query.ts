/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export type UseServicesOptions = {
  readonly page?: number
  readonly pageSize?: number
  readonly active?: boolean
}

export function useServices(options: UseServicesOptions = {}) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.services.list(options),
    queryFn: () => api.listServices(options),
  })
}
