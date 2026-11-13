/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { GetInfraCostsUseCase } from './getInfraCosts.use-case'
import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  INFRA_INVENTORY_CACHE_KEY,
} from '@adatechnology/infra-contracts'
import { buildFakeGateway } from './testing/buildFakeGateway'
import {
  INTEGRATION_AGENT_ID,
  INTEGRATION_IP_ADDRESS,
  buildIntegrationHarness,
} from './testing/buildIntegrationHarness'
import { FakeInfraCache } from './testing/FakeInfraCache'
import { ListInfraEnvironmentsUseCase } from './listInfraEnvironments.use-case'
import { VerifyInfraIntegrationUseCase } from './verifyInfraIntegration.use-case'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { InfraBillingCycle, InfraProject, InfraUsageRow } from '@adatechnology/infra-contracts'

const NOW = new Date('2026-10-04T14:00:00.000Z')
const CYCLE: InfraBillingCycle = {
  start: '2026-09-19T14:00:00.000Z',
  end: '2026-10-19T14:00:00.000Z',
  currentUsage: 10,
}
const PROJECTS: readonly InfraProject[] = [
  { id: 'p1', name: 'app', environments: [{ id: 'e1', name: 'staging', services: [] }] },
]
const ROWS: readonly InfraUsageRow[] = [
  { measurement: 'NETWORK_TX_GB', value: 10, projectId: 'p1', environmentId: 'e1' },
]

/** Segura a chamada ao Railway ate `release()`: simula a operacao em voo enquanto o token troca. */
function buildGate(): { readonly wait: Promise<void>; readonly release: () => void } {
  let release: () => void = () => undefined
  const wait = new Promise<void>((resolve) => (release = resolve))
  return { wait, release }
}

function buildSlowGateway(wait: Promise<void>): InfraGatewayInterface {
  return {
    ...buildFakeGateway({ projects: PROJECTS }),
    verifyAccess: async () => {
      await wait
      return 'ok'
    },
    listInventory: async () => {
      await wait
      return PROJECTS
    },
    getBillingCycle: async () => CYCLE,
    getUsage: async () => {
      await wait
      return ROWS
    },
  }
}

const operationRepository: InfraOperationRepositoryInterface = {
  async create() {
    throw new Error('not used')
  },
  async findById() {
    return undefined
  },
  async findRunningByEnvironmentId() {
    return undefined
  },
  async listRunning() {
    return []
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
    return []
  },
  async upsert() {
    throw new Error('not used')
  },
  async recordEvaluation() {},
  async setKeepOnUntil() {},
}

describe('cache nao e gravado com o resultado de um gateway que deixou de ser o atual', () => {
  it('listagem: troca de token durante a espera nao grava acesso nem inventario', async () => {
    const { wait, release } = buildGate()
    const cache = new FakeInfraCache()
    const gateway = buildSlowGateway(wait)
    let isCurrent = true
    const useCase = new ListInfraEnvironmentsUseCase({
      resolveGateway: async () => gateway,
      isGatewayCurrent: () => isCurrent,
      cache,
      operationRepository,
      scheduleRepository,
      managedPattern: 'staging',
      selfEnvironmentId: 'env-self',
      databaseWaitSeconds: 120,
      now: () => NOW,
    })

    const pending = useCase.execute()
    isCurrent = false
    release()
    const result = await pending

    expect(result.access).toBe('ok')
    expect(cache.store.has(INFRA_ACCESS_CACHE_KEY)).toBe(false)
    expect(cache.store.has(INFRA_INVENTORY_CACHE_KEY)).toBe(false)
  })

  it('listagem: sem troca, grava normalmente', async () => {
    const { wait, release } = buildGate()
    release()
    const cache = new FakeInfraCache()
    const useCase = new ListInfraEnvironmentsUseCase({
      resolveGateway: async () => buildSlowGateway(wait),
      isGatewayCurrent: () => true,
      cache,
      operationRepository,
      scheduleRepository,
      managedPattern: 'staging',
      selfEnvironmentId: 'env-self',
      databaseWaitSeconds: 120,
      now: () => NOW,
    })

    await useCase.execute()

    expect(cache.store.has(INFRA_ACCESS_CACHE_KEY)).toBe(true)
    expect(cache.store.has(INFRA_INVENTORY_CACHE_KEY)).toBe(true)
  })

  it('custos: troca de token durante a espera nao grava custos nem ultima copia boa', async () => {
    const { wait, release } = buildGate()
    const cache = new FakeInfraCache()
    let isCurrent = true
    const useCase = new GetInfraCostsUseCase({
      resolveGateway: async () => buildSlowGateway(wait),
      isGatewayCurrent: () => isCurrent,
      cache,
      sleep: async () => undefined,
      now: () => NOW,
    })

    const pending = useCase.execute()
    isCurrent = false
    release()
    const result = await pending

    expect(result.projects.length).toBeGreaterThan(0)
    expect(cache.store.has(INFRA_COSTS_CACHE_KEY)).toBe(false)
    expect(cache.store.has(INFRA_COSTS_LAST_GOOD_CACHE_KEY)).toBe(false)
  })

  it('verificacao: troca de token durante a espera nao grava o veredito', async () => {
    const { wait, release } = buildGate()
    const harness = buildIntegrationHarness()
    const gateway = buildSlowGateway(wait)
    harness.provider.gateway = gateway
    harness.provider.currentGateway = gateway
    const useCase = new VerifyInfraIntegrationUseCase(harness.dependencies)

    const pending = useCase.execute({ actor: { agentId: INTEGRATION_AGENT_ID }, ipAddress: INTEGRATION_IP_ADDRESS })
    harness.provider.currentGateway = buildFakeGateway({ projects: [] })
    release()
    const result = await pending

    expect(result).toEqual({ access: 'ok' })
    expect(harness.cache.store.has(INFRA_INTEGRATION_VERIFY_CACHE_KEY)).toBe(false)
    expect(harness.cache.store.has(INFRA_ACCESS_CACHE_KEY)).toBe(false)
  })
})
