/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTOR_TYPE } from '@adatechnology/railway-infra-contracts'
import { INFRA_COSTS_CACHE_KEY, INFRA_INVENTORY_CACHE_KEY } from '@adatechnology/railway-infra-contracts'
import { InfraEnvironmentNotFoundError, InfraNotConfiguredError } from '@adatechnology/railway-infra-contracts'
import { FakeInfraCache } from './testing/FakeInfraCache'
import { buildFakeGateway, type FakeGateway } from './testing/buildFakeGateway'
import { buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { GetInfraCostsUseCase } from './getInfraCosts.use-case'
import { ListInfraEnvironmentsUseCase } from './listInfraEnvironments.use-case'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { RunInfraSchedulesUseCase } from './runInfraSchedules.use-case'
import { SaveEnvironmentScheduleUseCase } from './saveEnvironmentSchedule.use-case'
import type { ResolveGateway } from '@adatechnology/railway-infra-contracts'

const ENVIRONMENT_ID = 'env-staging'
const NOW = new Date('2026-10-09T12:00:00Z')
const PROJECTS = [
  buildProject({
    environmentId: ENVIRONMENT_ID,
    environmentName: 'staging',
    services: [buildService({ name: 'web' })],
  }),
]

type GatewayHolder = { current: FakeGateway | undefined }

function buildHolder(initial: FakeGateway | undefined): {
  readonly holder: GatewayHolder
  readonly resolveGateway: ResolveGateway
} {
  const holder: GatewayHolder = { current: initial }
  return { holder, resolveGateway: async () => holder.current }
}

function spyOnCacheReads(cache: FakeInfraCache): { readonly reads: string[] } {
  const reads: string[] = []
  const originalGet = cache.get.bind(cache)
  cache.get = async (key) => {
    reads.push(key)
    return originalGet(key)
  }
  return { reads }
}

function buildListUseCase(params: { readonly resolveGateway: ResolveGateway; readonly cache: FakeInfraCache }) {
  const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
  return new ListInfraEnvironmentsUseCase({
    resolveGateway: params.resolveGateway,
    cache: params.cache,
    operationRepository: harness.repository,
    scheduleRepository: harness.scheduleRepository,
    managedPattern: 'staging',
    selfEnvironmentId: 'env-self',
    databaseWaitSeconds: 120,
    now: () => NOW,
  })
}

function buildCostsUseCase(params: { readonly resolveGateway: ResolveGateway; readonly cache: FakeInfraCache }) {
  return new GetInfraCostsUseCase({ ...params, sleep: async () => {}, now: () => NOW })
}

function buildSaveUseCase(resolveGateway: ResolveGateway) {
  const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
  const useCase = new SaveEnvironmentScheduleUseCase({
    resolveGateway,
    scheduleRepository: harness.scheduleRepository,
    recordAudit: harness.dependencies.recordAudit,
    managedPattern: 'staging',
    selfEnvironmentId: 'env-self',
    now: () => NOW,
  })
  return { harness, useCase }
}

const SAVE_PARAMS = {
  environmentId: ENVIRONMENT_ID,
  activeWeekdays: [1, 2, 3, 4, 5],
  powerOnTime: '08:00',
  powerOffTime: '20:00',
  isEnabled: true,
  actor: { type: INFRA_AUDIT_ACTOR_TYPE.AGENT, agentId: '33333333-3333-4333-8333-333333333333' },
} as const

describe('listInfraEnvironments with resolveGateway', () => {
  it('does not read the cache when the resolver returns undefined', async () => {
    const cache = new FakeInfraCache()
    const { reads } = spyOnCacheReads(cache)
    const useCase = buildListUseCase({ resolveGateway: async () => undefined, cache })

    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
    expect(reads).toEqual([])
  })

  it('uses the new gateway on the next call after the resolver switches', async () => {
    const first = buildFakeGateway({ projects: PROJECTS })
    const second = buildFakeGateway({ projects: PROJECTS })
    const { holder, resolveGateway } = buildHolder(first)
    const cache = new FakeInfraCache()
    const useCase = buildListUseCase({ resolveGateway, cache })

    await useCase.execute()
    holder.current = second
    cache.store.clear()
    await useCase.execute()

    expect([first.inventoryReads, second.inventoryReads]).toEqual([1, 1])
  })

  it('answers not configured again after the resolver loses the gateway, even with a filled cache', async () => {
    const { holder, resolveGateway } = buildHolder(buildFakeGateway({ projects: PROJECTS }))
    const cache = new FakeInfraCache()
    const useCase = buildListUseCase({ resolveGateway, cache })

    await useCase.execute()
    expect(cache.store.has(INFRA_INVENTORY_CACHE_KEY)).toBe(true)
    holder.current = undefined

    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
  })
})

function buildCostsGateway(): FakeGateway {
  return Object.assign(buildFakeGateway({ projects: PROJECTS }), {
    getBillingCycle: async () => ({
      start: '2026-09-19T14:00:00.000Z',
      end: '2026-10-19T14:00:00.000Z',
      currentUsage: 10,
    }),
  })
}

describe('getInfraCosts with resolveGateway', () => {
  it('does not read the cache when the resolver returns undefined', async () => {
    const cache = new FakeInfraCache()
    const { reads } = spyOnCacheReads(cache)
    const useCase = buildCostsUseCase({ resolveGateway: async () => undefined, cache })

    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
    expect(reads).toEqual([])
  })

  it('uses the new gateway on the next call after the resolver switches', async () => {
    const first = buildCostsGateway()
    const second = buildCostsGateway()
    const { holder, resolveGateway } = buildHolder(first)
    const cache = new FakeInfraCache()
    const useCase = buildCostsUseCase({ resolveGateway, cache })

    await useCase.execute()
    holder.current = second
    cache.store.clear()
    await useCase.execute()

    expect([first.inventoryReads, second.inventoryReads]).toEqual([1, 1])
  })

  it('answers not configured again after the resolver loses the gateway, even with a filled cache', async () => {
    const { holder, resolveGateway } = buildHolder(buildCostsGateway())
    const cache = new FakeInfraCache()
    const useCase = buildCostsUseCase({ resolveGateway, cache })

    await useCase.execute()
    expect(cache.store.has(INFRA_COSTS_CACHE_KEY)).toBe(true)
    holder.current = undefined

    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
  })
})

describe('saveEnvironmentSchedule with resolveGateway', () => {
  it('throws not configured when the resolver returns undefined and writes nothing', async () => {
    const { harness, useCase } = buildSaveUseCase(async () => undefined)

    await expect(useCase.execute(SAVE_PARAMS)).rejects.toBeInstanceOf(InfraNotConfiguredError)
    expect(harness.scheduleRepository.upsertCalls).toHaveLength(0)
  })

  it('locates the environment through the gateway the resolver returns at each call', async () => {
    const { holder, resolveGateway } = buildHolder(buildFakeGateway({ projects: [] }))
    const { harness, useCase } = buildSaveUseCase(resolveGateway)

    await expect(useCase.execute(SAVE_PARAMS)).rejects.toBeInstanceOf(InfraEnvironmentNotFoundError)
    holder.current = buildFakeGateway({ projects: PROJECTS })
    await useCase.execute(SAVE_PARAMS)

    expect(harness.scheduleRepository.upsertCalls).toHaveLength(1)
  })
})

describe('runInfraSchedules with resolveGateway', () => {
  it('does nothing without a gateway and recovers operations once one appears', async () => {
    const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
    const { holder, resolveGateway } = buildHolder(undefined)
    let recoveries = 0
    const useCase = new RunInfraSchedulesUseCase({
      resolveGateway,
      scheduleRepository: harness.scheduleRepository,
      powerOnEnvironment: { execute: async () => ({ operationId: 'unused' }) },
      powerOffEnvironment: { execute: async () => ({ operationId: 'unused' }) },
      recoverInterruptedOperations: {
        execute: async () => {
          recoveries += 1
          return 0
        },
      },
      logger: { info: () => undefined, error: () => undefined },
      now: () => NOW,
    })

    await useCase.execute()
    expect(recoveries).toBe(0)

    holder.current = harness.gateway
    await useCase.execute()
    expect(recoveries).toBe(1)
  })
})

describe('powerEnvironment with resolveGateway', () => {
  it('keeps the admitted gateway for the whole operation even if the resolver changes after the 202', async () => {
    const harness = buildPowerHarness({ gatewayOptions: { projects: PROJECTS } })
    const other = buildFakeGateway({ projects: PROJECTS })
    let resolutions = 0
    const resolveGateway: ResolveGateway = async () => {
      resolutions += 1
      return resolutions === 1 ? harness.gateway : other
    }
    const useCase = new PowerOffEnvironmentUseCase({ ...harness.dependencies, resolveGateway })

    await useCase.execute({ environmentId: ENVIRONMENT_ID, actor: SAVE_PARAMS.actor, trigger: 'manual' })
    for (let attempt = 0; attempt < 100 && harness.repository.operations[0]?.status === 'running'; attempt += 1) {
      await Bun.sleep(5)
    }

    expect(harness.gateway.events).toContain('stop:dep-web')
    expect(other.events).toEqual([])
    expect(other.inventoryReads).toBe(0)
    expect(resolutions).toBe(1)
  })

  it('throws not configured when the resolver returns undefined', async () => {
    const harness = buildPowerHarness({ gatewayOptions: { projects: PROJECTS } })
    const useCase = new PowerOffEnvironmentUseCase({ ...harness.dependencies, resolveGateway: async () => undefined })

    await expect(
      useCase.execute({ environmentId: ENVIRONMENT_ID, actor: SAVE_PARAMS.actor, trigger: 'manual' }),
    ).rejects.toBeInstanceOf(InfraNotConfiguredError)
    expect(harness.gateway.events).toEqual([])
  })
})
