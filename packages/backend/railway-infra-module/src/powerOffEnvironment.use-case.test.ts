/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_INVENTORY_CACHE_KEY, INFRA_OPERATION_LOCK_KEY_PREFIX } from '@adatechnology/railway-infra-contracts'
import {
  InfraEnvironmentNotFoundError,
  InfraEnvironmentProtectedError,
  InfraNotConfiguredError,
  InfraOperationInProgressError,
  RailwayRequestFailedError,
} from '@adatechnology/railway-infra-contracts'
import { FakeInfraCache } from './testing/FakeInfraCache'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import type { PowerEnvironmentParams, RunOperationParams } from '@adatechnology/railway-infra-contracts'
import type { RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'

const ENVIRONMENT_ID = 'env-staging'
const LOCK_KEY = `${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`
const LOCK_OWNER = 'mine'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'

const DEFAULT_SERVICES = [
  buildService({ name: 'web' }),
  buildService({ name: 'worker' }),
  buildService({ name: 'Postgres', image: 'postgres:16' }),
  buildService({ name: 'Redis', image: 'redis:8' }),
]

function buildHarness(params: {
  readonly environmentName?: string
  readonly environmentId?: string
  readonly services?: readonly RailwayServiceInstance[]
  readonly failMutation?: (mutation: string) => Error | undefined
  readonly gate?: Promise<void>
  readonly isConfigured?: boolean
}): { readonly harness: PowerHarness; readonly useCase: PowerOffEnvironmentUseCase } {
  const harness = buildPowerHarness({
    isConfigured: params.isConfigured ?? true,
    gatewayOptions: {
      projects: [
        buildProject({
          environmentId: params.environmentId ?? ENVIRONMENT_ID,
          environmentName: params.environmentName ?? 'staging',
          services: params.services ?? DEFAULT_SERVICES,
        }),
      ],
      ...(params.failMutation ? { failMutation: params.failMutation } : {}),
      ...(params.gate ? { gate: params.gate } : {}),
    },
  })
  return { harness, useCase: new PowerOffEnvironmentUseCase(harness.dependencies) }
}

function manualParams(overrides: Partial<PowerEnvironmentParams> = {}): PowerEnvironmentParams {
  return {
    environmentId: ENVIRONMENT_ID,
    actor: { type: 'agent', agentId: AGENT_ID },
    trigger: 'manual',
    ipAddress: '203.0.113.7',
    ...overrides,
  }
}

async function startOperation(
  harness: PowerHarness,
  overrides: Partial<RunOperationParams> = {},
): Promise<RunOperationParams> {
  const operation = await harness.repository.create({
    railwayProjectId: 'project-1',
    railwayEnvironmentId: ENVIRONMENT_ID,
    kind: 'power_off',
    trigger: 'manual',
  })
  return {
    gateway: harness.gateway,
    operationId: operation.id,
    projectId: 'project-1',
    projectName: 'ada',
    environmentId: ENVIRONMENT_ID,
    environmentName: 'staging',
    services: DEFAULT_SERVICES,
    actor: { type: 'agent', agentId: AGENT_ID },
    trigger: 'manual',
    lockOwner: LOCK_OWNER,
    ipAddress: '203.0.113.7',
    ...overrides,
  }
}

async function waitUntilFinished(harness: PowerHarness): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (harness.repository.operations.every((operation) => operation.status !== 'running')) return
    await Bun.sleep(1)
  }
  throw new Error('operation did not finish')
}

function expectNothingTouched(harness: PowerHarness): void {
  const mutations = harness.gateway.events.filter((event) => event !== 'read')
  expect(mutations).toEqual([])
  expect(harness.repository.operations).toEqual([])
  expect(harness.cache.setIfAbsentCalls).toEqual([])
  expect(harness.cache.store.size).toBe(0)
}

describe('PowerOffEnvironmentUseCase.execute — safety', () => {
  const refused = [
    { label: 'production', environmentName: 'production', environmentId: ENVIRONMENT_ID },
    { label: 'cbni-production', environmentName: 'cbni-production', environmentId: ENVIRONMENT_ID },
    { label: 'the own environment', environmentName: 'staging', environmentId: 'env-self' },
  ]

  for (const scenario of refused) {
    it(`refuses ${scenario.label} with zero mutations, zero operation and zero lock`, async () => {
      const { harness, useCase } = buildHarness({
        environmentName: scenario.environmentName,
        environmentId: scenario.environmentId,
      })

      await expect(useCase.execute(manualParams({ environmentId: scenario.environmentId }))).rejects.toBeInstanceOf(
        InfraEnvironmentProtectedError,
      )
      expectNothingTouched(harness)
    })
  }

  it('refuses an unmanaged environment with the same protected error (403) and touches nothing', async () => {
    const { harness, useCase } = buildHarness({ environmentName: 'dev' })

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraEnvironmentProtectedError)
    expectNothingTouched(harness)
  })

  it('throws InfraEnvironmentNotFoundError for an unknown environment and touches nothing', async () => {
    const { harness, useCase } = buildHarness({})

    await expect(useCase.execute(manualParams({ environmentId: 'env-missing' }))).rejects.toBeInstanceOf(
      InfraEnvironmentNotFoundError,
    )
    expectNothingTouched(harness)
  })

  it('throws InfraNotConfiguredError without a gateway', async () => {
    const { useCase } = buildHarness({ isConfigured: false })

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraNotConfiguredError)
  })

  it('classifies from a fresh inventory read, ignoring the cached one', async () => {
    const { harness, useCase } = buildHarness({ environmentName: 'production' })
    harness.cache.store.set(INFRA_INVENTORY_CACHE_KEY, '[]')

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraEnvironmentProtectedError)
    expect(harness.gateway.inventoryReads).toBe(1)
  })
})

describe('PowerOffEnvironmentUseCase.execute — lock and background run', () => {
  it('rejects with InfraOperationInProgressError when the lock is taken and keeps the other lock', async () => {
    const { harness, useCase } = buildHarness({})
    harness.cache.store.set(LOCK_KEY, 'someone-else')

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraOperationInProgressError)
    expect(harness.repository.operations).toEqual([])
    expect(harness.gateway.events).toEqual([])
    expect(harness.cache.store.get(LOCK_KEY)).toBe('someone-else')
  })

  it('acquires the lock with TTL = database wait + 600 s', async () => {
    const { harness, useCase } = buildHarness({})

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(harness.cache.setIfAbsentCalls[0]).toMatchObject({ key: LOCK_KEY, ttlSeconds: 720 })
  })

  it('answers with the operation id while the run is still going, then releases the lock at the end', async () => {
    let openGate: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    const { harness, useCase } = buildHarness({ gate })
    harness.cache.store.set(INFRA_INVENTORY_CACHE_KEY, '[]')

    const result = await useCase.execute(manualParams())

    expect(result).toEqual({ operationId: 'operation-1' })
    expect(harness.repository.operations[0]?.status).toBe('running')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(true)
    expect(harness.cache.store.has(INFRA_INVENTORY_CACHE_KEY)).toBe(false)

    openGate()
    await waitUntilFinished(harness)

    expect(harness.repository.operations[0]?.status).toBe('succeeded')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
  })

  it('releases the lock when creating the operation fails', async () => {
    const { harness, useCase } = buildHarness({})
    harness.repository.create = async () => {
      throw new Error('database down')
    }

    await expect(useCase.execute(manualParams())).rejects.toThrow('database down')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
    expect(harness.gateway.events).toEqual([])
  })

  it('fake cache setIfAbsent only succeeds for the first caller', async () => {
    const cache = new FakeInfraCache()
    const first = await cache.setIfAbsent({ key: 'k', value: 'a', ttlSeconds: 10 })
    const second = await cache.setIfAbsent({ key: 'k', value: 'b', ttlSeconds: 10 })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(await cache.get('k')).toBe('a')
  })
})

describe('PowerOffEnvironmentUseCase.runOperation', () => {
  it('stops applications in parallel first and databases after, then marks succeeded', async () => {
    const { harness, useCase } = buildHarness({})

    await useCase.runOperation(await startOperation(harness))

    const stops = harness.gateway.events
    expect(stops.slice(0, 2).sort()).toEqual(['stop:dep-web', 'stop:dep-worker'])
    expect(stops.slice(2).sort()).toEqual(['stop:dep-Postgres', 'stop:dep-Redis'])
    const operation = harness.repository.operations[0]
    expect(operation?.status).toBe('succeeded')
    expect(operation?.finishedAt).not.toBeNull()
    expect(operation?.serviceResults.map((result) => result.outcome)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })

  it('skips services already stopped or without deployment, including a SUCCESS deployment that is stopped', async () => {
    const stoppedButSuccess: RailwayServiceInstance = {
      ...buildService({ name: 'web', shape: 'stopped' }),
      instanceStatus: 'SUCCESS',
    }
    const services = [
      stoppedButSuccess,
      buildService({ name: 'worker', shape: 'none' }),
      buildService({ name: 'Redis', image: 'redis:8', shape: 'stopped' }),
      buildService({ name: 'cron' }),
    ]
    const { harness, useCase } = buildHarness({ services })

    await useCase.runOperation(await startOperation(harness, { services }))

    expect(harness.gateway.events).toEqual(['stop:dep-cron'])
    const outcomes = Object.fromEntries(
      (harness.repository.operations[0]?.serviceResults ?? []).map((result) => [result.serviceName, result.outcome]),
    )
    expect(outcomes).toEqual({ web: 'skipped', worker: 'skipped', Redis: 'skipped', cron: 'ok' })
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('keeps stopping the others when one fails and ends partially_failed with the error code', async () => {
    const { harness, useCase } = buildHarness({
      failMutation: (mutation) =>
        mutation === 'stop:dep-worker' ? new RailwayRequestFailedError('deploymentStop') : undefined,
    })

    await useCase.runOperation(await startOperation(harness))

    expect(harness.gateway.events.sort()).toEqual([
      'stop:dep-Postgres',
      'stop:dep-Redis',
      'stop:dep-web',
      'stop:dep-worker',
    ])
    const operation = harness.repository.operations[0]
    expect(operation?.status).toBe('partially_failed')
    expect(operation?.serviceResults.find((result) => result.serviceName === 'worker')).toEqual({
      serviceName: 'worker',
      outcome: 'failed',
      errorCode: 'RAILWAY_REQUEST_FAILED',
    })
  })

  it('ends failed when every service fails, recording INTERNAL_ERROR without the raw message', async () => {
    const { harness, useCase } = buildHarness({
      failMutation: () => new Error('leaked secret detail'),
    })

    await useCase.runOperation(await startOperation(harness))

    const operation = harness.repository.operations[0]
    expect(operation?.status).toBe('failed')
    expect(operation?.serviceResults.every((result) => result.errorCode === 'INTERNAL_ERROR')).toBe(true)
    expect(JSON.stringify(operation)).not.toContain('leaked')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
  })

  it('marks the operation failed and releases the lock when the runner blows up unexpectedly', async () => {
    const { harness, useCase } = buildHarness({})
    harness.cache.store.set(LOCK_KEY, LOCK_OWNER)
    harness.repository.finishFailures = 1

    await useCase.runOperation(await startOperation(harness))

    expect(harness.repository.operations[0]?.status).toBe('failed')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
    expect(harness.auditCalls[0]?.metadata).toMatchObject({ status: 'failed' })
  })

  it('still releases the lock and logs when even marking failed is impossible', async () => {
    const { harness, useCase } = buildHarness({})
    harness.cache.store.set(LOCK_KEY, LOCK_OWNER)
    harness.repository.finishFailures = 2

    await useCase.runOperation(await startOperation(harness))

    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
    expect(harness.logMessages).toContain('Nao foi possivel marcar a operacao de infra como falha')
  })

  it('renews the lock after every processed service with the full TTL', async () => {
    const { harness, useCase } = buildHarness({})
    harness.cache.store.set(LOCK_KEY, LOCK_OWNER)

    await useCase.runOperation(await startOperation(harness))

    const renewals = harness.cache.renewCalls.filter((call) => call.key === LOCK_KEY)
    expect(renewals).toHaveLength(4)
    expect(renewals.every((call) => call.owner === LOCK_OWNER && call.ttlSeconds === 720)).toBe(true)
  })

  it('invalidates the inventory cache when the operation ends', async () => {
    const { harness, useCase } = buildHarness({})
    harness.cache.store.set(INFRA_INVENTORY_CACHE_KEY, '[]')

    await useCase.runOperation(await startOperation(harness))

    expect(harness.cache.deletedKeys).toContain(INFRA_INVENTORY_CACHE_KEY)
    expect(harness.cache.store.has(INFRA_INVENTORY_CACHE_KEY)).toBe(false)
  })
})

describe('PowerOffEnvironmentUseCase audit', () => {
  it('audits an agent action with actor, target UUID-like id, ip and a token-free metadata', async () => {
    const { harness, useCase } = buildHarness({})

    await useCase.runOperation(await startOperation(harness))

    expect(harness.auditCalls).toHaveLength(1)
    const audit = harness.auditCalls[0]
    expect(audit).toMatchObject({
      actorType: 'agent',
      actorId: AGENT_ID,
      action: 'infra.environment_powered_off',
      targetType: 'infra_environment',
      targetId: ENVIRONMENT_ID,
      ipAddress: '203.0.113.7',
    })
    expect(audit?.metadata).toMatchObject({
      operationId: 'operation-1',
      projectName: 'ada',
      environmentName: 'staging',
      trigger: 'manual',
      status: 'succeeded',
      counts: { ok: 4, failed: 0, skipped: 0 },
    })
    expect(JSON.stringify(audit).toLowerCase()).not.toContain('token')
  })

  it('audits the schedule trigger as the system actor without actorId', async () => {
    const { harness, useCase } = buildHarness({})

    await useCase.runOperation(await startOperation(harness, { actor: { type: 'system' }, trigger: 'schedule' }))

    const audit = harness.auditCalls[0]
    expect(audit?.actorType).toBe('system')
    expect(audit).not.toHaveProperty('actorId')
    expect(audit?.metadata).toMatchObject({ trigger: 'schedule' })
  })

  it('does not change the operation status nor keep the lock when the audit write fails', async () => {
    const { harness, useCase } = buildHarness({})
    harness.failAudit = true
    harness.cache.store.set(LOCK_KEY, LOCK_OWNER)

    await useCase.runOperation(await startOperation(harness))

    expect(harness.repository.operations[0]?.status).toBe('succeeded')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
    expect(harness.logMessages).toContain('Nao foi possivel gravar a auditoria da operacao de infra')
  })
})
