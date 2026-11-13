/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_OPERATION_LOCK_KEY_PREFIX } from '@adatechnology/infra-contracts'
import { InfraProviderRequestFailedError } from '@adatechnology/infra-contracts'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'
import type { RunOperationParams } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

const ENVIRONMENT_ID = 'env-staging'
const LOCK_KEY = `${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`

const POSTGRES_IMAGE = 'postgres:16'

function buildStoppedServices(): InfraServiceInstance[] {
  return [
    buildService({ name: 'web', shape: 'stopped' }),
    buildService({ name: 'worker', shape: 'stopped' }),
    buildService({ name: 'Postgres', image: POSTGRES_IMAGE, shape: 'stopped' }),
  ]
}

function buildHarness(params: {
  readonly services: readonly InfraServiceInstance[]
  readonly environmentServices?: (readNumber: number) => readonly InfraServiceInstance[]
  readonly failMutation?: (mutation: string) => Error | undefined
  readonly databaseWaitSeconds?: number
}): { readonly harness: PowerHarness; readonly useCase: PowerOnEnvironmentUseCase } {
  const harness = buildPowerHarness({
    ...(params.databaseWaitSeconds ? { databaseWaitSeconds: params.databaseWaitSeconds } : {}),
    gatewayOptions: {
      projects: [
        buildProject({ environmentId: ENVIRONMENT_ID, environmentName: 'staging', services: params.services }),
      ],
      environmentServices:
        params.environmentServices ??
        (() =>
          params.services.map((service) =>
            buildService({ name: service.serviceName, ...(service.sourceImage ? { image: service.sourceImage } : {}) }),
          )),
      ...(params.failMutation ? { failMutation: params.failMutation } : {}),
    },
  })
  return { harness, useCase: new PowerOnEnvironmentUseCase(harness.dependencies) }
}

async function startOperation(
  harness: PowerHarness,
  services: readonly InfraServiceInstance[],
): Promise<RunOperationParams> {
  const operation = await harness.repository.create({
    railwayProjectId: 'project-1',
    railwayEnvironmentId: ENVIRONMENT_ID,
    kind: 'power_on',
    trigger: 'manual',
  })
  return {
    gateway: harness.gateway,
    operationId: operation.id,
    projectId: 'project-1',
    projectName: 'ada',
    environmentId: ENVIRONMENT_ID,
    environmentName: 'staging',
    services,
    actor: { type: 'agent', agentId: '11111111-1111-4111-8111-111111111111' },
    trigger: 'manual',
    lockOwner: 'mine',
  }
}

function resultsByName(harness: PowerHarness): Record<string, unknown> {
  return Object.fromEntries(
    (harness.repository.operations[0]?.serviceResults ?? []).map((result) => [result.serviceName, result]),
  )
}

describe('PowerOnEnvironmentUseCase.runOperation', () => {
  it('starts databases before applications and waits for the database state in between', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({ services })

    await useCase.runOperation(await startOperation(harness, services))

    const { events } = harness.gateway
    expect(events.slice(0, 2)).toEqual(['restart:dep-Postgres', 'read'])
    expect(events.slice(2).sort()).toEqual(['restart:dep-web', 'restart:dep-worker'])
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
    expect(harness.sleeps).toEqual([])
  })

  it('polls the environment every 5 s until the database is RUNNING (ready on the 3rd read)', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      environmentServices: (readNumber) => [
        buildService({ name: 'Postgres', image: POSTGRES_IMAGE, shape: readNumber >= 3 ? 'running' : 'stopped' }),
      ],
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.environmentReads).toBe(3)
    expect(harness.sleeps).toEqual([5000, 5000])
    expect(harness.gateway.events.filter((event) => event.startsWith('restart:dep-web'))).toHaveLength(1)
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('does not treat a stopped SUCCESS deployment as ready', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      databaseWaitSeconds: 10,
      environmentServices: () => [
        { ...buildService({ name: 'Postgres', image: POSTGRES_IMAGE, shape: 'stopped' }), instanceStatus: 'SUCCESS' },
      ],
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(resultsByName(harness).Postgres).toMatchObject({ outcome: 'failed', errorCode: 'INFRA_DATABASE_NOT_READY' })
  })

  it('fails the database with INFRA_DATABASE_NOT_READY and skips applications when it never gets ready', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      databaseWaitSeconds: 10,
      environmentServices: () => [buildService({ name: 'Postgres', image: POSTGRES_IMAGE, shape: 'stopped' })],
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.events.filter((event) => event.startsWith('restart:'))).toEqual(['restart:dep-Postgres'])
    expect(harness.gateway.environmentReads).toBe(3)
    expect(harness.sleeps).toEqual([5000, 5000])
    expect(resultsByName(harness)).toEqual({
      Postgres: { serviceName: 'Postgres', outcome: 'failed', errorCode: 'INFRA_DATABASE_NOT_READY' },
      web: { serviceName: 'web', outcome: 'skipped' },
      worker: { serviceName: 'worker', outcome: 'skipped' },
    })
    expect(harness.repository.operations[0]?.status).toBe('failed')
    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
  })

  it('skips applications when the database restart itself fails, without waiting for it', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      failMutation: (mutation) =>
        mutation === 'restart:dep-Postgres' ? new InfraProviderRequestFailedError('deploymentRestart') : undefined,
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.environmentReads).toBe(0)
    expect(resultsByName(harness).Postgres).toMatchObject({
      outcome: 'failed',
      errorCode: 'INFRA_PROVIDER_REQUEST_FAILED',
    })
    expect(resultsByName(harness).web).toMatchObject({ outcome: 'skipped' })
    expect(harness.repository.operations[0]?.status).toBe('failed')
  })

  it('uses redeployService for services without a deployment', async () => {
    const services = [
      buildService({ name: 'web', shape: 'none' }),
      buildService({ name: 'Redis', image: 'redis:8', shape: 'none' }),
    ]
    const { harness, useCase } = buildHarness({ services })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.events.filter((event) => event !== 'read')).toEqual([
      `redeploy:${ENVIRONMENT_ID}/svc-Redis`,
      `redeploy:${ENVIRONMENT_ID}/svc-web`,
    ])
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('skips services that are already running and sends no mutation', async () => {
    const services = [buildService({ name: 'web' }), buildService({ name: 'Postgres', image: POSTGRES_IMAGE })]
    const { harness, useCase } = buildHarness({ services })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.events.filter((event) => event !== 'read')).toEqual([])
    expect(harness.repository.operations[0]?.serviceResults.map((result) => result.outcome)).toEqual([
      'skipped',
      'skipped',
    ])
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('keeps starting the other applications when one fails and ends partially_failed', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      failMutation: (mutation) =>
        mutation === 'restart:dep-web' ? new InfraProviderRequestFailedError('deploymentRestart') : undefined,
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.events).toContain('restart:dep-worker')
    expect(resultsByName(harness).web).toMatchObject({ outcome: 'failed', errorCode: 'INFRA_PROVIDER_REQUEST_FAILED' })
    expect(harness.repository.operations[0]?.status).toBe('partially_failed')
  })

  it('survives a failed environment read during the wait and keeps polling', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({
      services,
      environmentServices: (readNumber) => {
        if (readNumber === 1) throw new InfraProviderRequestFailedError('getEnvironmentServices')
        return [buildService({ name: 'Postgres', image: POSTGRES_IMAGE })]
      },
    })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.gateway.environmentReads).toBe(2)
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('audits the power on action and invalidates the inventory cache', async () => {
    const services = buildStoppedServices()
    const { harness, useCase } = buildHarness({ services })

    await useCase.runOperation(await startOperation(harness, services))

    expect(harness.auditCalls[0]).toMatchObject({
      actorType: 'agent',
      action: 'infra.environment_powered_on',
      targetType: 'infra_environment',
      targetId: ENVIRONMENT_ID,
    })
    expect(harness.auditCalls[0]?.metadata).toMatchObject({
      status: 'succeeded',
      counts: { ok: 3, failed: 0, skipped: 0 },
    })
    expect(harness.cache.deletedKeys).toContain('infra:inventory')
  })
})
