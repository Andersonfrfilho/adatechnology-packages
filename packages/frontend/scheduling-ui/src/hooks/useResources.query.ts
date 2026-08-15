/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useQuery } from '@tanstack/react-query'
import type { ResourceKind } from '@adatechnology/scheduling-contracts'

import { useScheduling } from '../providers/SchedulingProvider'
import { SCHEDULING_QUERY_KEYS } from './queryKeys'

export type UseResourcesOptions = {
  readonly page?: number
  readonly pageSize?: number
  readonly kind?: ResourceKind
  readonly active?: boolean
}

export function useResources(options: UseResourcesOptions = {}) {
  const api = useScheduling()

  return useQuery({
    queryKey: SCHEDULING_QUERY_KEYS.resources.list(options),
    queryFn: () => api.listResources(options),
  })
}
