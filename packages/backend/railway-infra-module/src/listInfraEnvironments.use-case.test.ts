/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_ACCESS_CACHE_KEY, INFRA_INVENTORY_CACHE_KEY } from '@adatechnology/railway-infra-contracts'
import { InfraNotConfiguredError } from '@adatechnology/railway-infra-contracts'
import { ListInfraEnvironmentsUseCase } from './listInfraEnvironments.use-case'
import type { InfraAccessStatus } from '@adatechnology/railway-infra-contracts'
import type { InfraOperationRecord } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRecord } from '@adatechnology/railway-infra-contracts'
import type { RailwayProject, RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'
import type { InfraCacheInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'

function buildService(overrides: Partial<RailwayServiceInstance> = {}): RailwayServiceInstance {
  return {
    serviceId: 'svc-1',
    serviceName: 'api',
    hasDeployment: true,
    isStopped: false,
    instanceStatus: 'RUNNING',
    ...overrides,
  }
}

function buildProject(params: {
  readonly name: string
  readonly environments: readonly { id: string; name: string; services: RailwayServiceInstance[] }[]
}): RailwayProject {
  return { id: `project-${params.name}`, name: params.name, environments: params.environments }
}

function buildSchedule(environmentId: string): InfraScheduleRecord {
  const now = new Date('2026-01-01T00:00:00Z')
  return {
    id: 'schedule-1',
    railwayProjectId: 'project-a',
    railwayEnvironmentId: environmentId,
    activeWeekdays: [1, 2, 3],
    powerOnTime: '08:00',
    powerOffTime: '20:00',
    timezone: 'America/Sao_Paulo',
    isEnabled: true,
    keepOnUntil: null,
    lastEvaluatedAt: null,
    lastPowerOffAt: null,
    lastPowerOnAt: null,
    updatedByAgentId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function buildOperation(environmentId: string): InfraOperationRecord {
  return {
    id: 'operation-1',
    railwayProjectId: 'project-a',
    railwayEnvironmentId: environmentId,
    kind: 'power_off',
    status: 'running',
    trigger: 'manual',
    actorAgentId: null,
    serviceResults: [],
    startedAt: new Date('2026-10-09T11:59:00Z'),
    finishedAt: null,
  }
}

type Harness = {
  readonly useCase: ListInfraEnvironmentsUseCase
  readonly counters: { inventory: number; access: number; schedules: number; operations: number }
  readonly schedules: InfraScheduleRecord[]
  readonly operations: InfraOperationRecord[]
  readonly store: Map<string, string>
  readonly ttls: Map<string, number | undefined>
}

function buildHarness(params: {
  readonly projects: readonly RailwayProject[]
  readonly access?: InfraAccessStatus
  readonly isConfigured?: boolean
  readonly hasSchedulesFailure?: boolean
}): Harness {
  const counters = { inventory: 0, access: 0, schedules: 0, operations: 0 }
  const schedules: InfraScheduleRecord[] = []
  const operations: InfraOperationRecord[] = []
  const store = new Map<string, string>()
  const ttls = new Map<string, number | undefined>()

  const gateway: RailwayGatewayInterface = {
    async listInventory() {
      counters.inventory += 1
      return params.projects
    },
    async verifyAccess() {
      counters.access += 1
      return params.access ?? 'ok'
    },
    async getEnvironmentServices() {
      return []
    },
    async stopDeployment() {},
    async restartDeployment() {},
    async redeployService() {},
    async getBillingCycle() {
      throw new Error('not used')
    },
    async getUsage() {
      return []
    },
    async getEstimatedUsage() {
      return []
    },
  }

  const cache: InfraCacheInterface = {
    async get(key) {
      return store.get(key) ?? null
    },
    async set(key, value, ttlSeconds) {
      store.set(key, value)
      ttls.set(key, ttlSeconds)
    },
    async setIfAbsent(setParams) {
      if (store.has(setParams.key)) return false
      store.set(setParams.key, setParams.value)
      return true
    },
    async renewIfOwner() {
      return false
    },
    async releaseIfOwner() {
      return false
    },
    async delete(key) {
      store.delete(key)
    },
  }

  const operationRepository: InfraOperationRepositoryInterface = {
    async create() {
      throw new Error('not used')
    },
    async findById() {
      return undefined
    },
    async findRunningByEnvironmentId() {
      throw new Error('N+1: the listing must use listRunning')
    },
    async listRunning(listParams) {
      counters.operations += 1
      return operations.filter((operation) => operation.startedAt > listParams.notOlderThan)
    },
    async finishOperation() {},
    async markStaleRunningAsInterrupted() {
      return []
    },
  }

  const scheduleRepository: InfraScheduleRepositoryInterface = {
    async findByEnvironmentId() {
      return undefined
    },
    async listAll() {
      counters.schedules += 1
      if (params.hasSchedulesFailure) throw new Error('database down')
      return schedules
    },
    async upsert() {
      throw new Error('not used')
    },
    async recordEvaluation() {},
    async setKeepOnUntil() {},
  }

  const useCase = new ListInfraEnvironmentsUseCase({
    resolveGateway: async () => (params.isConfigured === false ? undefined : gateway),
    cache,
    operationRepository,
    scheduleRepository,
    managedPattern: 'staging',
    selfEnvironmentId: 'env-self',
    databaseWaitSeconds: 120,
    now: () => new Date('2026-10-09T12:00:00Z'),
  })

  return { useCase, counters, schedules, operations, store, ttls }
}

function singleEnvironment(services: RailwayServiceInstance[], name = 'staging'): RailwayProject[] {
  return [buildProject({ name: 'app', environments: [{ id: 'env-1', name, services }] })]
}

async function stateOf(services: RailwayServiceInstance[]): Promise<string | undefined> {
  const { useCase } = buildHarness({ projects: singleEnvironment(services) })
  const result = await useCase.execute()
  return result.projects[0]?.environments[0]?.state
}

describe('ListInfraEnvironmentsUseCase', () => {
  it('throws InfraNotConfiguredError when the gateway is missing', async () => {
    const { useCase } = buildHarness({ projects: [], isConfigured: false })
    await expect(useCase.execute()).rejects.toBeInstanceOf(InfraNotConfiguredError)
  })

  it('classifies staging as managed, production as protected and the own environment as protected', async () => {
    const projects = [
      buildProject({
        name: 'app',
        environments: [
          { id: 'env-1', name: 'staging', services: [] },
          { id: 'env-2', name: 'production', services: [] },
          { id: 'env-self', name: 'internal', services: [] },
        ],
      }),
    ]
    const { useCase } = buildHarness({ projects })
    const result = await useCase.execute()
    const classifications = Object.fromEntries(
      (result.projects[0]?.environments ?? []).map((environment) => [
        environment.environmentName,
        environment.classification,
      ]),
    )
    expect(classifications).toEqual({ internal: 'protected', production: 'protected', staging: 'managed' })
  })

  it('marks the environment as running when every service is running', async () => {
    expect(await stateOf([buildService(), buildService({ serviceName: 'worker' })])).toBe('running')
  })

  it('counts a stopped deployment with SUCCESS status as stopped', async () => {
    const stopped = buildService({ isStopped: true, instanceStatus: 'SUCCESS' })
    expect(await stateOf([stopped, buildService({ serviceName: 'db', hasDeployment: false })])).toBe('stopped')
  })

  it('marks the environment as partial when running and stopped services are mixed', async () => {
    expect(await stateOf([buildService(), buildService({ serviceName: 'worker', isStopped: true })])).toBe('partial')
  })

  it('marks the environment as transitioning when any service is transitioning', async () => {
    expect(await stateOf([buildService(), buildService({ serviceName: 'worker', instanceStatus: 'DEPLOYING' })])).toBe(
      'transitioning',
    )
  })

  it('treats an environment without services as stopped', async () => {
    expect(await stateOf([])).toBe('stopped')
  })

  it('flags database services and exposes the service power state', async () => {
    const { useCase } = buildHarness({
      projects: singleEnvironment([
        buildService(),
        buildService({ serviceName: 'Postgres', sourceImage: 'postgres:16' }),
      ]),
    })
    const result = await useCase.execute()
    expect(result.projects[0]?.environments[0]?.services).toEqual([
      { serviceName: 'api', isDatabase: false, powerState: 'running' },
      { serviceName: 'Postgres', isDatabase: true, powerState: 'running' },
    ])
  })

  it('returns no projects and skips the inventory when the token is invalid', async () => {
    const { useCase, counters } = buildHarness({
      projects: singleEnvironment([buildService()]),
      access: 'token_invalid',
    })
    const result = await useCase.execute()
    expect(result).toEqual({ access: 'token_invalid', projects: [] })
    expect(counters.inventory).toBe(0)
  })

  it('caches access for 300 s when ok or billing_unavailable and 60 s when the token is invalid', async () => {
    const expectedTtls: readonly (readonly [InfraAccessStatus, number])[] = [
      ['ok', 300],
      ['billing_unavailable', 300],
      ['token_invalid', 60],
    ]

    for (const [access, ttl] of expectedTtls) {
      const harness = buildHarness({ projects: singleEnvironment([buildService()]), access })
      await harness.useCase.execute()
      expect(harness.ttls.get(INFRA_ACCESS_CACHE_KEY)).toBe(ttl)
    }
  })

  it('does not cache an unavailable verdict and returns no projects', async () => {
    const harness = buildHarness({ projects: singleEnvironment([buildService()]), access: 'unavailable' })

    const result = await harness.useCase.execute()
    await harness.useCase.execute()

    expect(result).toEqual({ access: 'unavailable', projects: [] })
    expect(harness.store.has(INFRA_ACCESS_CACHE_KEY)).toBe(false)
    expect(harness.counters.access).toBe(2)
    expect(harness.counters.inventory).toBe(0)
  })

  it('treats an invalid inventory cache as a miss instead of throwing', async () => {
    for (const stored of ['{not json', '{"wrong":true}']) {
      const harness = buildHarness({ projects: singleEnvironment([buildService()]) })
      harness.store.set(INFRA_INVENTORY_CACHE_KEY, stored)

      const result = await harness.useCase.execute()

      expect(harness.counters.inventory).toBe(1)
      expect(result.projects).toHaveLength(1)
    }
  })

  it('serves the inventory and access from cache but rereads schedules and operations', async () => {
    const harness = buildHarness({ projects: singleEnvironment([buildService()]) })
    await harness.useCase.execute()
    harness.schedules.push(buildSchedule('env-1'))
    harness.operations.push(buildOperation('env-1'))
    const second = await harness.useCase.execute()

    expect(harness.counters.inventory).toBe(1)
    expect(harness.counters.access).toBe(1)
    expect(harness.counters.schedules).toBe(2)
    expect(harness.counters.operations).toBe(2)
    expect(second.projects[0]?.environments[0]?.runningOperationId).toBe('operation-1')
    expect(second.projects[0]?.environments[0]?.schedule?.powerOnTime).toBe('08:00')
  })

  it('attaches schedule and running operation only to the matching environment', async () => {
    const projects = [
      buildProject({
        name: 'app',
        environments: [
          { id: 'env-1', name: 'staging', services: [] },
          { id: 'env-3', name: 'dev', services: [] },
        ],
      }),
    ]
    const harness = buildHarness({ projects })
    harness.schedules.push(buildSchedule('env-1'))
    harness.operations.push(buildOperation('env-1'))
    const result = await harness.useCase.execute()
    const [dev, staging] = result.projects[0]?.environments ?? []

    expect(staging?.schedule?.railwayEnvironmentId).toBe('env-1')
    expect(staging?.runningOperationId).toBe('operation-1')
    expect(dev?.schedule).toBeUndefined()
    expect(dev?.runningOperationId).toBeUndefined()
  })

  it('reads running operations once per listing, not once per environment', async () => {
    const projects = [
      buildProject({
        name: 'app',
        environments: ['a', 'b', 'c'].map((name) => ({ id: `env-${name}`, name: `staging-${name}`, services: [] })),
      }),
      buildProject({ name: 'api', environments: [{ id: 'env-d', name: 'staging-d', services: [] }] }),
    ]
    const harness = buildHarness({ projects })
    harness.operations.push(buildOperation('env-b'))

    const result = await harness.useCase.execute()

    expect(harness.counters.operations).toBe(1)
    const running = result.projects.flatMap((project) => project.environments).filter((view) => view.runningOperationId)
    expect(running.map((view) => view.environmentId)).toEqual(['env-b'])
  })

  it('ignores a running operation older than the lock TTL (wait 120 s + 600 s grace)', async () => {
    const harness = buildHarness({ projects: singleEnvironment([buildService()]) })
    harness.operations.push({ ...buildOperation('env-1'), startedAt: new Date('2026-10-09T11:47:00Z') })

    const result = await harness.useCase.execute()

    expect(result.projects[0]?.environments[0]?.runningOperationId).toBeUndefined()
  })

  it('propagates repository failures instead of swallowing them', async () => {
    const { useCase } = buildHarness({ projects: singleEnvironment([buildService()]), hasSchedulesFailure: true })
    await expect(useCase.execute()).rejects.toThrow('database down')
  })

  it('orders projects and environments by name', async () => {
    const projects = [
      buildProject({ name: 'zeta', environments: [{ id: 'z1', name: 'staging', services: [] }] }),
      buildProject({
        name: 'alpha',
        environments: [
          { id: 'a2', name: 'staging', services: [] },
          { id: 'a1', name: 'dev', services: [] },
        ],
      }),
    ]
    const { useCase } = buildHarness({ projects })
    const result = await useCase.execute()
    expect(result.projects.map((project) => project.projectName)).toEqual(['alpha', 'zeta'])
    expect(result.projects[0]?.environments.map((environment) => environment.environmentName)).toEqual([
      'dev',
      'staging',
    ])
  })
})

describe('ListInfraEnvironmentsUseCase - nextScheduledAction', () => {
  it('traz a proxima acao calculada no servidor para ambiente com agenda', async () => {
    const harness = buildHarness({ projects: singleEnvironment([buildService()]) })
    harness.schedules.push({ ...buildSchedule('env-1'), activeWeekdays: [1, 2, 3, 4, 5] })

    const result = await harness.useCase.execute()

    // Sexta 09:00 BRT esta dentro da janela: a proxima acao e desligar as 20:00 BRT (23:00Z).
    expect(result.projects[0]?.environments[0]?.nextScheduledAction).toEqual({
      kind: 'power_off',
      at: '2026-10-09T23:00:00.000Z',
    })
  })

  it('omite nextScheduledAction quando nao ha agenda', async () => {
    const result = await buildHarness({ projects: singleEnvironment([buildService()]) }).useCase.execute()

    expect(result.projects[0]?.environments[0]).not.toHaveProperty('nextScheduledAction')
  })
})

describe('ListInfraEnvironmentsUseCase - requiresKeepOnUntil', () => {
  // Sexta 09:00 BRT: dentro da janela só quando sexta (5) está nos dias ativos.
  async function requiresFor(schedule: Partial<InfraScheduleRecord> | undefined): Promise<boolean | undefined> {
    const harness = buildHarness({ projects: singleEnvironment([buildService()]) })
    if (schedule) harness.schedules.push({ ...buildSchedule('env-1'), ...schedule })
    const result = await harness.useCase.execute()
    return result.projects[0]?.environments[0]?.requiresKeepOnUntil
  }

  it('agenda ativa dentro da janela -> false', async () => {
    expect(await requiresFor({ activeWeekdays: [1, 2, 3, 4, 5] })).toBe(false)
  })

  it('agenda ativa fora da janela -> true', async () => {
    expect(await requiresFor({ activeWeekdays: [1, 2, 3] })).toBe(true)
  })

  it('agenda ativa fora da janela com keepOnUntil vigente (próxima ação power_off) -> true', async () => {
    const keepOnUntil = new Date('2026-10-09T14:00:00Z')
    expect(await requiresFor({ activeWeekdays: [1, 2, 3], keepOnUntil })).toBe(true)
  })

  it('agenda pausada -> false', async () => {
    expect(await requiresFor({ activeWeekdays: [1, 2, 3], isEnabled: false })).toBe(false)
  })

  it('sem agenda -> false', async () => {
    expect(await requiresFor(undefined)).toBe(false)
  })
})
