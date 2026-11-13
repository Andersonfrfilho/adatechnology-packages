/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { MutationObserver, QueryClient, QueryObserver, type MutationFunction } from '@tanstack/react-query'

import { INFRA_QUERY_KEY } from '../constants/infra.constant'
import type { InfraIntegrationView, SaveInfraIntegrationParams } from '../types/infraIntegration.types'

const savedView: MutationFunction<InfraIntegrationView, SaveInfraIntegrationParams> = async () => ({
  source: 'panel',
  state: 'configured',
  environmentTokenAlsoPresent: false,
})

const BAIT_TOKEN = 'ISCA-TOKEN-0123456789'

let hook: typeof import('./infraIntegration.hook')

beforeAll(async () => {
  hook = await import('./infraIntegration.hook')
})

describe('mutacoes que carregam segredo', () => {
  it('salvar e remover usam gcTime 0', () => {
    const queryClient = new QueryClient()

    expect(hook.buildSaveIntegrationOptions({ queryClient, api: {} }).gcTime).toBe(0)
    expect(hook.buildRemoveIntegrationOptions({ queryClient, api: {} }).gcTime).toBe(0)
    expect(hook.SENSITIVE_MUTATION_GC_TIME_MS).toBe(0)
  })

  it('o cache de mutacao nao retem o token depois de terminar e resetar', async () => {
    const queryClient = new QueryClient()
    const options = {
      ...hook.buildSaveIntegrationOptions({ queryClient, api: {} }),
      mutationFn: savedView,
    }
    const observer = new MutationObserver(queryClient, options)

    await observer.mutate({ token: BAIT_TOKEN, password: 'senha' })
    observer.reset()
    await new Promise((resolve) => setTimeout(resolve, 10))

    const retained = JSON.stringify(
      queryClient
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    )
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(retained).not.toContain(BAIT_TOKEN)
  })
})

describe('invalidacao depois de mexer na integracao', () => {
  it('invalida integracao, ambientes e custos', async () => {
    const queryClient = new QueryClient()
    const keys = [INFRA_QUERY_KEY.INTEGRATION, INFRA_QUERY_KEY.ENVIRONMENTS, INFRA_QUERY_KEY.COSTS]
    for (const key of keys) queryClient.setQueryData([key], {})

    await hook.invalidateInfraQueries(queryClient)

    for (const key of keys) expect(queryClient.getQueryState([key])?.isInvalidated).toBe(true)
  })

  it('salvar e remover invalidam integracao, ambientes e custos ao terminar, sem devolver Promise', () => {
    const queryClient = new QueryClient()
    const builders = [hook.buildSaveIntegrationOptions, hook.buildRemoveIntegrationOptions]
    const keys = [INFRA_QUERY_KEY.INTEGRATION, INFRA_QUERY_KEY.ENVIRONMENTS, INFRA_QUERY_KEY.COSTS]

    for (const build of builders) {
      for (const key of keys) queryClient.setQueryData([key], {})
      const returned: unknown = (build({ queryClient, api: {} }).onSettled as () => unknown)()

      expect(returned).toBeUndefined()
      for (const key of keys) expect(queryClient.getQueryState([key])?.isInvalidated).toBe(true)
    }
  })

  it('verificar invalida so a integracao: ambientes e custos nao dependem do veredito', () => {
    const queryClient = new QueryClient()
    const keys = [INFRA_QUERY_KEY.INTEGRATION, INFRA_QUERY_KEY.ENVIRONMENTS, INFRA_QUERY_KEY.COSTS]
    for (const key of keys) queryClient.setQueryData([key], {})

    const returned: unknown = (
      hook.buildVerifyIntegrationOptions({ queryClient, api: {} }).onSettled as () => unknown
    )()

    expect(returned).toBeUndefined()
    expect(queryClient.getQueryState([INFRA_QUERY_KEY.INTEGRATION])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState([INFRA_QUERY_KEY.ENVIRONMENTS])?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState([INFRA_QUERY_KEY.COSTS])?.isInvalidated).toBe(false)
  })
})

describe('limpeza de segredo logo apos a resposta', () => {
  it('o callback de sucesso roda mesmo com a releitura da integracao ainda pendente', async () => {
    const queryClient = new QueryClient()
    const neverResolves = new QueryObserver(queryClient, {
      queryKey: [INFRA_QUERY_KEY.INTEGRATION],
      queryFn: () => new Promise<never>(() => undefined),
    })
    const unsubscribe = neverResolves.subscribe(() => undefined)
    const observer = new MutationObserver(queryClient, {
      ...hook.buildSaveIntegrationOptions({ queryClient, api: {} }),
      mutationFn: savedView,
    })

    const unsubscribeMutation = observer.subscribe(() => undefined)
    const cleared = new Promise<string>((resolve) => {
      void observer.mutate({ token: BAIT_TOKEN, password: 'senha' }, { onSuccess: () => resolve('cleared') })
    })
    const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 200))

    expect(await Promise.race([cleared, timeout])).toBe('cleared')
    unsubscribe()
    unsubscribeMutation()
    observer.reset()
  })
})
