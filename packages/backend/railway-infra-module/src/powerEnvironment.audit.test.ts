/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import { INFRA_OPERATION_LOCK_KEY_PREFIX } from '@adatechnology/railway-infra-contracts'
import {
  InfraEnvironmentNotFoundError,
  InfraEnvironmentProtectedError,
  InfraKeepOnUntilRequiredError,
  InfraOperationInProgressError,
} from '@adatechnology/railway-infra-contracts'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'
import type { PowerEnvironmentParams } from '@adatechnology/railway-infra-contracts'

const ENVIRONMENT_ID = '22222222-2222-4222-8222-222222222222'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'
// Sabado: fora da janela comercial da agenda abaixo.
const OUTSIDE_WINDOW = new Date('2026-10-10T15:00:00Z')

function buildHarness(params: { readonly environmentName?: string; readonly now?: Date } = {}): PowerHarness {
  return buildPowerHarness({
    ...(params.now ? { now: params.now } : {}),
    gatewayOptions: {
      projects: [
        buildProject({
          environmentId: ENVIRONMENT_ID,
          environmentName: params.environmentName ?? 'staging',
          services: [buildService({ name: 'web', shape: 'stopped' })],
        }),
      ],
      environmentServices: () => [buildService({ name: 'web' })],
    },
  })
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

async function waitUntilFinished(harness: PowerHarness): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (harness.repository.operations.every((operation) => operation.status !== 'running')) return
    await Bun.sleep(1)
  }
  throw new Error('operation did not finish')
}

function deniedAudits(harness: PowerHarness): readonly unknown[] {
  return harness.auditCalls.filter((call) => call.action === INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWER_DENIED)
}

describe('PowerEnvironmentUseCase - audit of requests', () => {
  it('audits power_requested with actor, ip, target and metadata before returning the operation id', async () => {
    const harness = buildHarness()
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    const result = await useCase.execute(manualParams())

    expect(harness.auditCalls).toHaveLength(1)
    expect(harness.auditCalls[0]).toEqual({
      actorType: 'agent',
      actorId: AGENT_ID,
      ipAddress: '203.0.113.7',
      action: 'infra.environment_power_requested',
      targetType: 'infra_environment',
      targetId: ENVIRONMENT_ID,
      metadata: {
        operationId: result.operationId,
        direction: 'off',
        trigger: 'manual',
        projectName: 'ada',
        environmentName: 'staging',
      },
    })
    await waitUntilFinished(harness)
  })

  it('audits a schedule request as the system actor', async () => {
    const harness = buildHarness()
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await useCase.execute({ environmentId: ENVIRONMENT_ID, actor: { type: 'system' }, trigger: 'schedule' })
    await waitUntilFinished(harness)

    expect(harness.auditCalls[0]).toMatchObject({
      actorType: 'system',
      metadata: { direction: 'on', trigger: 'schedule' },
    })
    expect(harness.auditCalls[0]).not.toHaveProperty('actorId')
  })

  it('still accepts the action when the request audit cannot be written', async () => {
    const harness = buildHarness()
    harness.failAudit = true
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    const result = await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(result.operationId).toBe('operation-1')
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })
})

describe('PowerEnvironmentUseCase - audit of denials', () => {
  it('audits a protected environment with reason INFRA_ENVIRONMENT_PROTECTED and rethrows', async () => {
    const harness = buildHarness({ environmentName: 'production' })
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraEnvironmentProtectedError)

    expect(harness.auditCalls).toEqual([
      {
        actorType: 'agent',
        actorId: AGENT_ID,
        ipAddress: '203.0.113.7',
        action: 'infra.environment_power_denied',
        targetType: 'infra_environment',
        targetId: ENVIRONMENT_ID,
        metadata: { direction: 'off', trigger: 'manual', reason: 'INFRA_ENVIRONMENT_PROTECTED' },
      },
    ])
  })

  it('audits an unknown environment with reason INFRA_ENVIRONMENT_NOT_FOUND, targeting the requested UUID', async () => {
    const harness = buildHarness()
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)
    const missingId = '33333333-3333-4333-8333-333333333333'

    await expect(useCase.execute(manualParams({ environmentId: missingId }))).rejects.toBeInstanceOf(
      InfraEnvironmentNotFoundError,
    )

    expect(harness.auditCalls[0]).toMatchObject({
      action: 'infra.environment_power_denied',
      targetId: missingId,
      metadata: { reason: 'INFRA_ENVIRONMENT_NOT_FOUND' },
    })
  })

  it('omits targetId when the requested environment id is not a UUID', async () => {
    const harness = buildHarness()
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams({ environmentId: 'not-a-uuid' }))).rejects.toBeInstanceOf(
      InfraEnvironmentNotFoundError,
    )

    expect(harness.auditCalls[0]).not.toHaveProperty('targetId')
  })

  it('audits a busy lock with reason INFRA_OPERATION_IN_PROGRESS and rethrows', async () => {
    const harness = buildHarness()
    harness.cache.store.set(`${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`, 'someone-else')
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraOperationInProgressError)

    expect(harness.auditCalls[0]).toMatchObject({
      action: 'infra.environment_power_denied',
      metadata: { reason: 'INFRA_OPERATION_IN_PROGRESS' },
    })
  })

  it('audits a missing keepOnUntil with reason INFRA_KEEP_ON_UNTIL_REQUIRED and rethrows', async () => {
    const harness = buildHarness({ now: OUTSIDE_WINDOW })
    harness.scheduleRepository.seed({
      id: 'schedule-1',
      railwayProjectId: 'project-1',
      railwayEnvironmentId: ENVIRONMENT_ID,
      activeWeekdays: [1, 2, 3, 4, 5],
      powerOnTime: '08:00',
      powerOffTime: '20:00',
      timezone: 'America/Sao_Paulo',
      isEnabled: true,
      keepOnUntil: null,
      lastEvaluatedAt: null,
      lastPowerOffAt: null,
      lastPowerOnAt: null,
      updatedByAgentId: null,
      createdAt: OUTSIDE_WINDOW,
      updatedAt: OUTSIDE_WINDOW,
    })
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraKeepOnUntilRequiredError)

    expect(harness.auditCalls[0]).toMatchObject({
      action: 'infra.environment_power_denied',
      metadata: { direction: 'on', trigger: 'manual', reason: 'INFRA_KEEP_ON_UNTIL_REQUIRED' },
    })
  })

  it('audits a schedule denial as the system actor', async () => {
    const harness = buildHarness({ environmentName: 'production' })
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(
      useCase.execute({ environmentId: ENVIRONMENT_ID, actor: { type: 'system' }, trigger: 'schedule' }),
    ).rejects.toBeInstanceOf(InfraEnvironmentProtectedError)

    expect(harness.auditCalls[0]).toMatchObject({ actorType: 'system', metadata: { trigger: 'schedule' } })
  })

  it('rethrows the original error when the denial audit itself fails', async () => {
    const harness = buildHarness({ environmentName: 'production' })
    harness.failAudit = true
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams())).rejects.toBeInstanceOf(InfraEnvironmentProtectedError)
    expect(harness.logMessages).toContain('Nao foi possivel gravar a auditoria de infra')
  })

  it('does not audit an accepted action as denied', async () => {
    const harness = buildHarness()
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(deniedAudits(harness)).toHaveLength(0)
  })
})
