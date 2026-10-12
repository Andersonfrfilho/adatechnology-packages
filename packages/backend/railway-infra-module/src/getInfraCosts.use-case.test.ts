/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import {
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_CACHE_TTL_SECONDS,
  INFRA_COSTS_FALLBACK_CACHE_TTL_SECONDS,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
} from '@adatechnology/railway-infra-contracts'
import {
  InfraNotConfiguredError,
  RailwayRateLimitedError,
  RailwayRequestFailedError,
} from '@adatechnology/railway-infra-contracts'
import { GetInfraCostsUseCase } from './getInfraCosts.use-case'
import { FakeInfraCache } from './testing/FakeInfraCache'
import { buildFakeGateway } from './testing/buildFakeGateway'
import type { GetUsageParams } from '@adatechnology/railway-infra-contracts'
import type { RailwayBillingCycle, RailwayProject, RailwayUsageRow } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'

const CYCLE: RailwayBillingCycle = {
  start: '2026-09-19T14:00:00.000Z',
  end: '2026-10-19T14:00:00.000Z',
  currentUsage: 10,
}
const PROJECTS: readonly RailwayProject[] = [
  {
    id: 'p1',
    name: 'transportada',
    environments: [
      { id: 'e1', name: 'production', services: [] },
      { id: 'e2', name: 'staging', services: [] },
    ],
  },
]
// 10 GB de rede = US$ 0,50 em e1 e US$ 0,50 em e2; mais memoria de e1: 43 200 GB-min = US$ 10 -> total US$ 11.
const ROWS: readonly RailwayUsageRow[] = [
  { measurement: 'MEMORY_USAGE_GB', value: 43_200, projectId: 'p1', environmentId: 'e1' },
  { measurement: 'NETWORK_TX_GB', value: 10, projectId: 'p1', environmentId: 'e1' },
  { measurement: 'NETWORK_TX_GB', value: 10, projectId: 'p1', environmentId: 'e2' },
]
const NOW = new Date('2026-10-04T14:00:00.000Z')

function buildUseCase(params: {
  readonly cycle?: RailwayBillingCycle | 'unavailable'
  readonly usageFailures?: number
  readonly usageError?: Error
  readonly cache?: FakeInfraCache
  readonly isConfigured?: boolean
}) {
  const cache = params.cache ?? new FakeInfraCache()
  const usageCalls: GetUsageParams[] = []
  const sleeps: number[] = []
  let remainingFailures = params.usageFailures ?? 0
  const base = buildFakeGateway({ projects: PROJECTS })
  const cycle = params.cycle ?? CYCLE
  const gateway: RailwayGatewayInterface = {
    ...base,
    listInventory: async () => PROJECTS,
    getBillingCycle: async () => {
      if (cycle === 'unavailable') throw new RailwayRequestFailedError('getBillingCycle')
      return cycle
    },
    getUsage: async (usageParams) => {
      usageCalls.push(usageParams)
      if (remainingFailures > 0) {
        remainingFailures -= 1
        throw params.usageError ?? new RailwayRequestFailedError('getUsage')
      }
      return ROWS
    },
  }
  const useCase = new GetInfraCostsUseCase({
    resolveGateway: async () => (params.isConfigured === false ? undefined : gateway),
    cache,
    sleep: async (milliseconds) => void sleeps.push(milliseconds),
    now: () => NOW,
  })
  return { useCase, cache, usageCalls, sleeps }
}

describe('GetInfraCostsUseCase', () => {
  it('sem gateway lanca InfraNotConfiguredError', async () => {
    const { useCase } = buildUseCase({ isConfigured: false })
    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
  })

  it('calcula custo, projecao linear e envia o FIM do ciclo como endDate', async () => {
    const { useCase, usageCalls } = buildUseCase({})
    const result = await useCase.execute()

    expect(usageCalls).toEqual([{ startDate: CYCLE.start, endDate: CYCLE.end }])
    expect(result.windowSource).toBe('billing_cycle')
    expect(result.totalCost).toBeCloseTo(11, 4)
    expect(result.officialTotal).toBe(10)
    expect(result.divergencePercent).toBeCloseTo(10, 2)
    expect(result.isDivergent).toBe(true)
    // 15 dias de 30 decorridos: fator 2.
    expect(result.projectedTotal).toBeCloseTo(22, 3)
    expect(result.projectionMethod).toBe('linear')
    expect(result.isStale).toBe(false)
    expect(result.pricingCheckedAt).toBe('2026-10-09')
    expect(result.pricingSource).toBe('https://docs.railway.com/pricing/plans')

    const project = result.projects[0]
    expect(project?.projectName).toBe('transportada')
    expect(project?.cost).toBeCloseTo(11, 4)
    expect(project?.projected).toBeCloseTo(22, 3)
    expect(project?.environments.map((environment) => [environment.environmentName, environment.isProduction])).toEqual(
      [
        ['production', true],
        ['staging', false],
      ],
    )
    expect(project?.environments[0]?.byMeasurement.MEMORY_USAGE_GB).toBeCloseTo(10, 4)
  })

  it('divergencia ate 5% nao marca isDivergent', async () => {
    const { useCase } = buildUseCase({ cycle: { ...CYCLE, currentUsage: 10.8 } })
    const result = await useCase.execute()

    expect(result.divergencePercent).toBeCloseTo(1.85, 2)
    expect(result.isDivergent).toBe(false)
  })

  it('billing indisponivel usa o mes-calendario e omite officialTotal', async () => {
    const { useCase, usageCalls } = buildUseCase({ cycle: 'unavailable' })
    const result = await useCase.execute()

    expect(result.windowSource).toBe('calendar_month')
    expect(result.officialTotal).toBeUndefined()
    expect(result.divergencePercent).toBeUndefined()
    expect(result.isDivergent).toBe(false)
    expect(usageCalls).toEqual([{ startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-31T23:59:59.999Z' }])
  })

  it('segunda chamada vem do cache e nao chama getUsage', async () => {
    const { useCase, usageCalls, cache } = buildUseCase({})
    await useCase.execute()
    await useCase.execute()

    expect(usageCalls).toHaveLength(1)
    expect(cache.setCalls.find((call) => call.key === INFRA_COSTS_CACHE_KEY)?.ttlSeconds).toBe(
      INFRA_COSTS_CACHE_TTL_SECONDS,
    )
  })

  it('falha unica de usage: tenta de novo apos 2 s e conclui', async () => {
    const { useCase, usageCalls, sleeps } = buildUseCase({ usageFailures: 1 })
    const result = await useCase.execute()

    expect(usageCalls).toHaveLength(2)
    expect(sleeps).toEqual([2000])
    expect(result.isStale).toBe(false)
  })

  it('falha dupla com copia anterior devolve a copia com isStale', async () => {
    const cache = new FakeInfraCache()
    await buildUseCase({ cache }).useCase.execute()
    cache.store.delete(INFRA_COSTS_CACHE_KEY)

    const { useCase, usageCalls } = buildUseCase({ cache, usageFailures: 2 })
    const result = await useCase.execute()

    expect(usageCalls).toHaveLength(2)
    expect(result.isStale).toBe(true)
    expect(result.totalCost).toBeCloseTo(11, 4)
    expect(cache.store.has(INFRA_COSTS_LAST_GOOD_CACHE_KEY)).toBe(true)
  })

  it('falha dupla sem copia propaga RailwayRequestFailedError', async () => {
    const { useCase } = buildUseCase({ usageFailures: 2 })
    await expect(useCase.execute()).rejects.toBeInstanceOf(RailwayRequestFailedError)
  })

  it('429 no usage propaga na hora, sem segunda tentativa nem espera', async () => {
    const { useCase, usageCalls, sleeps } = buildUseCase({
      usageFailures: 2,
      usageError: new RailwayRateLimitedError(30),
    })

    await expect(useCase.execute()).rejects.toBeInstanceOf(RailwayRateLimitedError)
    expect(usageCalls).toHaveLength(1)
    expect(sleeps).toEqual([])
  })

  it('429 no usage com copia anterior devolve a copia como antiga, sem repetir a chamada', async () => {
    const cache = new FakeInfraCache()
    await buildUseCase({ cache }).useCase.execute()
    cache.store.delete(INFRA_COSTS_CACHE_KEY)

    const { useCase, usageCalls, sleeps } = buildUseCase({
      cache,
      usageFailures: 2,
      usageError: new RailwayRateLimitedError(30),
    })
    const result = await useCase.execute()

    expect(result.isStale).toBe(true)
    expect(usageCalls).toHaveLength(1)
    expect(sleeps).toEqual([])
  })

  it('mes-calendario por falha do billing: TTL curto e fora do last-good', async () => {
    const { useCase, cache } = buildUseCase({ cycle: 'unavailable' })

    const result = await useCase.execute()

    expect(result.windowSource).toBe('calendar_month')
    expect(cache.setCalls.find((call) => call.key === INFRA_COSTS_CACHE_KEY)?.ttlSeconds).toBe(
      INFRA_COSTS_FALLBACK_CACHE_TTL_SECONDS,
    )
    expect(cache.store.has(INFRA_COSTS_LAST_GOOD_CACHE_KEY)).toBe(false)
  })

  it('JSON invalido ou de forma antiga no cache e miss', async () => {
    for (const stored of ['{nao e json', '{"totalCost":1}', 'null']) {
      const cache = new FakeInfraCache()
      cache.store.set(INFRA_COSTS_CACHE_KEY, stored)
      const { useCase, usageCalls } = buildUseCase({ cache })

      const result = await useCase.execute()

      expect(usageCalls).toHaveLength(1)
      expect(result.totalCost).toBeCloseTo(11, 4)
    }
  })

  it('last-good invalido nao vira copia antiga: propaga o erro do usage', async () => {
    const cache = new FakeInfraCache()
    cache.store.set(INFRA_COSTS_LAST_GOOD_CACHE_KEY, '{"totalCost":1}')
    const { useCase } = buildUseCase({ cache, usageFailures: 2 })

    await expect(useCase.execute()).rejects.toBeInstanceOf(RailwayRequestFailedError)
  })
})
