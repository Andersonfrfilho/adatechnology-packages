/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import {
  INFRA_COSTS_STALE_TIME_MS,
  INFRA_ENVIRONMENT_POWER_STATE,
  INFRA_OPERATION_STATUS,
  INFRA_POLL_INTERVAL_MS,
  INFRA_QUERY_KEY,
} from '../constants/infra.constant'
import { requireInfraMethod, useInfraApi } from '../providers/InfraProvider'
import type {
  InfraCosts,
  InfraOperation,
  ListInfraEnvironmentsResult,
  PowerEnvironmentResult,
  PowerOffEnvironmentParams,
  PowerOnEnvironmentParams,
  SaveEnvironmentScheduleParams,
  SaveEnvironmentScheduleResult,
} from '../types/infra.types'

/** Polling só enquanto há operação em curso: lista parada não justifica uma chamada ao provedor a cada 15 s. */
export function shouldPollEnvironments(data: ListInfraEnvironmentsResult | undefined): boolean {
  if (!data) return false

  return data.projects.some((project) =>
    project.environments.some(
      (environment) =>
        environment.runningOperationId !== undefined ||
        environment.state === INFRA_ENVIRONMENT_POWER_STATE.TRANSITIONING,
    ),
  )
}

export function useInfraEnvironments(): UseQueryResult<ListInfraEnvironmentsResult> {
  const api = useInfraApi()

  return useQuery({
    queryKey: [INFRA_QUERY_KEY.ENVIRONMENTS],
    queryFn: () => requireInfraMethod(api.listEnvironments, 'listEnvironments').call(api),
    refetchInterval: (query) => (shouldPollEnvironments(query.state.data) ? INFRA_POLL_INTERVAL_MS : false),
  })
}

export function useInfraOperation(operationId: string | undefined): UseQueryResult<InfraOperation> {
  const api = useInfraApi()

  return useQuery({
    queryKey: [INFRA_QUERY_KEY.OPERATION, operationId],
    queryFn: () => requireInfraMethod(api.getOperation, 'getOperation').call(api, { operationId: operationId ?? '' }),
    enabled: operationId !== undefined && api.getOperation !== undefined,
    refetchInterval: (query) =>
      query.state.data?.status === INFRA_OPERATION_STATUS.RUNNING ? INFRA_POLL_INTERVAL_MS : false,
  })
}

export function usePowerOffEnvironment(): UseMutationResult<PowerEnvironmentResult, Error, PowerOffEnvironmentParams> {
  const api = useInfraApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params) => requireInfraMethod(api.powerOffEnvironment, 'powerOffEnvironment').call(api, params),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.ENVIRONMENTS] }),
  })
}

export function usePowerOnEnvironment(): UseMutationResult<PowerEnvironmentResult, Error, PowerOnEnvironmentParams> {
  const api = useInfraApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params) => requireInfraMethod(api.powerOnEnvironment, 'powerOnEnvironment').call(api, params),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.ENVIRONMENTS] }),
  })
}

export function useSaveEnvironmentSchedule(): UseMutationResult<
  SaveEnvironmentScheduleResult,
  Error,
  SaveEnvironmentScheduleParams
> {
  const api = useInfraApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params) => requireInfraMethod(api.saveSchedule, 'saveSchedule').call(api, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.ENVIRONMENTS] }),
  })
}

export function useInfraCosts(): UseQueryResult<InfraCosts> {
  const api = useInfraApi()

  return useQuery({
    queryKey: [INFRA_QUERY_KEY.COSTS],
    queryFn: () => requireInfraMethod(api.getCosts, 'getCosts').call(api),
    staleTime: INFRA_COSTS_STALE_TIME_MS,
  })
}
