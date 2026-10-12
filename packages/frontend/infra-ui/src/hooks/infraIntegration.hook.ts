/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect } from 'react'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { INFRA_QUERY_KEY } from '../constants/infra.constant'
import { INFRA_INTEGRATION_STALE_TIME_MS } from '../constants/infraIntegration.constant'
import { requireInfraMethod, useInfraApi, type InfraApi } from '../providers'
import type {
  InfraIntegrationView,
  RemoveInfraIntegrationParams,
  SaveInfraIntegrationParams,
  VerifyInfraIntegrationResult,
} from '../types/infraIntegration.types'

/** Zero: o cache de mutação guarda as variáveis (token e senha) e não pode reter nenhuma depois de terminar. */
export const SENSITIVE_MUTATION_GC_TIME_MS = 0

type SaveOptions = UseMutationOptions<InfraIntegrationView, Error, SaveInfraIntegrationParams>
type RemoveOptions = UseMutationOptions<InfraIntegrationView, Error, RemoveInfraIntegrationParams>
type VerifyOptions = UseMutationOptions<VerifyInfraIntegrationResult, Error, void>

export type BuildIntegrationOptionsParams = {
  readonly queryClient: QueryClient
  readonly api: InfraApi
}

/** A integração mudou: ambientes e custos dependem da credencial, então saem do cache junto. */
export async function invalidateInfraQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.INTEGRATION] }),
    queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.ENVIRONMENTS] }),
    queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.COSTS] }),
  ])
}

/** Sem devolver a Promise: o react-query esperaria a releitura antes dos callbacks que limpam token e senha. */
function invalidateWithoutWaiting(queryClient: QueryClient): void {
  void invalidateInfraQueries(queryClient)
}

export function buildSaveIntegrationOptions({ queryClient, api }: BuildIntegrationOptionsParams): SaveOptions {
  return {
    mutationFn: (params) => requireInfraMethod(api.saveIntegration, 'saveIntegration').call(api, params),
    gcTime: SENSITIVE_MUTATION_GC_TIME_MS,
    onSettled: () => invalidateWithoutWaiting(queryClient),
  }
}

export function buildRemoveIntegrationOptions({ queryClient, api }: BuildIntegrationOptionsParams): RemoveOptions {
  return {
    mutationFn: (params) => requireInfraMethod(api.removeIntegration, 'removeIntegration').call(api, params),
    gcTime: SENSITIVE_MUTATION_GC_TIME_MS,
    onSettled: () => invalidateWithoutWaiting(queryClient),
  }
}

export function buildVerifyIntegrationOptions({ queryClient, api }: BuildIntegrationOptionsParams): VerifyOptions {
  return {
    mutationFn: () => requireInfraMethod(api.verifyIntegration, 'verifyIntegration').call(api),
    // O veredito só atualiza a própria integração; ambientes e custos não mudam com ele.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [INFRA_QUERY_KEY.INTEGRATION] })
    },
  }
}

export function useInfraIntegration(): UseQueryResult<InfraIntegrationView> {
  const api = useInfraApi()

  return useQuery({
    queryKey: [INFRA_QUERY_KEY.INTEGRATION],
    queryFn: () => requireInfraMethod(api.getIntegration, 'getIntegration').call(api),
    staleTime: INFRA_INTEGRATION_STALE_TIME_MS,
  })
}

export function useSaveInfraIntegration(): UseMutationResult<InfraIntegrationView, Error, SaveInfraIntegrationParams> {
  return useMutation(buildSaveIntegrationOptions({ queryClient: useQueryClient(), api: useInfraApi() }))
}

export function useRemoveInfraIntegration(): UseMutationResult<
  InfraIntegrationView,
  Error,
  RemoveInfraIntegrationParams
> {
  return useMutation(buildRemoveIntegrationOptions({ queryClient: useQueryClient(), api: useInfraApi() }))
}

export function useVerifyInfraIntegration(): UseMutationResult<VerifyInfraIntegrationResult, Error, void> {
  return useMutation(buildVerifyIntegrationOptions({ queryClient: useQueryClient(), api: useInfraApi() }))
}

/** Ao sair da tela o estado da mutação (variáveis incluídas) é descartado, mesmo no meio de uma tentativa. */
export function useResetMutationOnUnmount(reset: () => void): void {
  useEffect(() => reset, [reset])
}
