/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { FakeOperationRepository } from './testing/FakeOperationRepository'
import { buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { RecoverInterruptedInfraOperationsUseCase } from './recoverInterruptedInfraOperations.use-case'
import { RunInfraSchedulesUseCase } from './runInfraSchedules.use-case'

const NOW = new Date('2026-10-09T12:00:00.000Z')
const ENVIRONMENT_ID = '22222222-2222-4222-8222-222222222222'
const DATABASE_WAIT_SECONDS = 120
const SIXTY_SECONDS_MS = 60_000

function buildSetup(params: { readonly clock: { now: Date } }) {
  const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
  const logs: { readonly level: 'info' | 'error'; readonly message: string }[] = []
  const recover = new RecoverInterruptedInfraOperationsUseCase({
    operationRepository: harness.repository,
    recordAudit: harness.dependencies.recordAudit,
    logger: harness.dependencies.logger,
    databaseWaitSeconds: DATABASE_WAIT_SECONDS,
    now: () => params.clock.now,
  })
  const useCase = new RunInfraSchedulesUseCase({
    resolveGateway: async () => harness.gateway,
    scheduleRepository: harness.scheduleRepository,
    powerOnEnvironment: { execute: async () => ({ operationId: 'unused' }) },
    powerOffEnvironment: { execute: async () => ({ operationId: 'unused' }) },
    recoverInterruptedOperations: recover,
    logger: {
      info: (message) => void logs.push({ level: 'info', message }),
      error: (message) => void logs.push({ level: 'error', message }),
    },
    now: () => params.clock.now,
  })
  return { harness, logs, useCase }
}

async function seedRunning(params: {
  readonly repository: FakeOperationRepository
  readonly startedAt: Date
}): Promise<void> {
  params.repository.nextStartedAt = params.startedAt
  await params.repository.create({
    railwayProjectId: 'project-1',
    railwayEnvironmentId: ENVIRONMENT_ID,
    kind: 'power_off',
    trigger: 'manual',
  })
}

describe('RunInfraSchedulesUseCase - recovery on every tick', () => {
  it('hides a 13-minute running operation from findRunning and listRunning', async () => {
    const { harness } = buildSetup({ clock: { now: NOW } })
    await seedRunning({ repository: harness.repository, startedAt: new Date(NOW.getTime() - 13 * SIXTY_SECONDS_MS) })
    const notOlderThan = new Date(NOW.getTime() - (DATABASE_WAIT_SECONDS + 600) * 1000)

    expect(
      await harness.repository.findRunningByEnvironmentId({ environmentId: ENVIRONMENT_ID, notOlderThan }),
    ).toBeUndefined()
    expect(await harness.repository.listRunning({ notOlderThan })).toEqual([])
  })

  it('does not block a new power request because of the stuck operation', async () => {
    const harness = buildPowerHarness({
      gatewayOptions: {
        projects: [
          buildProject({
            environmentId: ENVIRONMENT_ID,
            environmentName: 'staging',
            services: [buildService({ name: 'web' })],
          }),
        ],
      },
    })
    await seedRunning({ repository: harness.repository, startedAt: new Date(NOW.getTime() - 13 * SIXTY_SECONDS_MS) })
    const powerOff = new PowerOffEnvironmentUseCase(harness.dependencies)

    const result = await powerOff.execute({
      environmentId: ENVIRONMENT_ID,
      actor: { type: 'system' },
      trigger: 'schedule',
    })

    expect(result.operationId).toBe('operation-2')
  })

  it('marks the stuck operation as failed on the next tick and audits it', async () => {
    const { harness, useCase } = buildSetup({ clock: { now: NOW } })
    await seedRunning({ repository: harness.repository, startedAt: new Date(NOW.getTime() - 13 * SIXTY_SECONDS_MS) })

    await useCase.execute()

    expect(harness.repository.operations[0]?.status).toBe('failed')
    expect(harness.auditCalls.map((call) => call.action)).toEqual(['infra.operation_interrupted'])
  })

  it('leaves a live operation alone one minute after boot', async () => {
    const { harness, useCase } = buildSetup({ clock: { now: NOW } })
    await seedRunning({ repository: harness.repository, startedAt: new Date(NOW.getTime() - SIXTY_SECONDS_MS) })

    await useCase.execute()

    expect(harness.repository.operations[0]?.status).toBe('running')
    expect(harness.auditCalls).toEqual([])
  })

  it('logs and still evaluates the schedules when the recovery throws', async () => {
    const { harness, logs, useCase } = buildSetup({ clock: { now: NOW } })
    harness.repository.markStaleRunningAsInterrupted = async () => {
      throw new Error('database down')
    }
    let schedulesRead = 0
    harness.scheduleRepository.listAll = async () => {
      schedulesRead += 1
      return []
    }

    await useCase.execute()

    expect(schedulesRead).toBe(1)
    expect(logs).toContainEqual({ level: 'error', message: 'Falha ao recuperar operacoes de infra interrompidas' })
  })
})
