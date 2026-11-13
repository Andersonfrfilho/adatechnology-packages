/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { FakeOperationRepository } from './testing/FakeOperationRepository'
import { buildPowerHarness } from './testing/buildPowerHarness'
import { RecoverInterruptedInfraOperationsUseCase } from './recoverInterruptedInfraOperations.use-case'

const NOW = new Date('2026-10-09T12:00:00.000Z')
const ENVIRONMENT_ID = '22222222-2222-4222-8222-222222222222'

function buildSetup(params: { readonly databaseWaitSeconds: number }) {
  const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
  const repository = new FakeOperationRepository()
  const useCase = new RecoverInterruptedInfraOperationsUseCase({
    operationRepository: repository,
    recordAudit: harness.dependencies.recordAudit,
    logger: harness.dependencies.logger,
    databaseWaitSeconds: params.databaseWaitSeconds,
    now: () => NOW,
  })
  return { harness, repository, useCase }
}

async function seedOperation(params: {
  readonly repository: FakeOperationRepository
  readonly environmentId: string
  readonly startedAt: Date
}): Promise<void> {
  params.repository.nextStartedAt = params.startedAt
  await params.repository.create({
    railwayProjectId: 'project-1',
    railwayEnvironmentId: params.environmentId,
    kind: 'power_off',
    trigger: 'manual',
  })
}

describe('RecoverInterruptedInfraOperationsUseCase', () => {
  it('marks operations older than wait + 600 s, returns the count and audits each one', async () => {
    const { harness, repository, useCase } = buildSetup({ databaseWaitSeconds: 120 })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('2026-10-09T11:40:00.000Z') })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('2026-10-09T11:59:00.000Z') })

    const recovered = await useCase.execute()

    expect(recovered).toBe(1)
    expect(repository.staleCalls).toEqual([{ olderThan: new Date('2026-10-09T11:48:00.000Z') }])
    expect(repository.operations.map((operation) => operation.status)).toEqual(['failed', 'running'])
    expect(harness.auditCalls).toEqual([
      {
        actorType: 'system',
        action: 'infra.operation_interrupted',
        targetType: 'infra_environment',
        targetId: ENVIRONMENT_ID,
        metadata: {
          operationId: 'operation-1',
          kind: 'power_off',
          startedAt: '2026-10-09T11:40:00.000Z',
          railwayEnvironmentId: ENVIRONMENT_ID,
        },
      },
    ])
  })

  it('omits targetId when the stored environment id is not a UUID', async () => {
    const { harness, repository, useCase } = buildSetup({ databaseWaitSeconds: 120 })
    await seedOperation({ repository, environmentId: 'env-legacy', startedAt: new Date('2026-10-09T11:00:00.000Z') })

    await useCase.execute()

    expect(harness.auditCalls[0]).not.toHaveProperty('targetId')
  })

  it('returns zero, audits nothing and uses wait + 600 s as cutoff when nothing is stale', async () => {
    const { harness, repository, useCase } = buildSetup({ databaseWaitSeconds: 600 })

    expect(await useCase.execute()).toBe(0)
    expect(repository.staleCalls[0]?.olderThan).toEqual(new Date('2026-10-09T11:40:00.000Z'))
    expect(harness.auditCalls).toEqual([])
  })

  it('keeps the recovery when the audit write fails', async () => {
    const { harness, repository, useCase } = buildSetup({ databaseWaitSeconds: 120 })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('2026-10-09T11:00:00.000Z') })
    harness.failAudit = true

    expect(await useCase.execute()).toBe(1)
    expect(repository.operations[0]?.status).toBe('failed')
  })

  it('keeps auditing the other operations when one audit entry cannot be built', async () => {
    const { harness, repository, useCase } = buildSetup({ databaseWaitSeconds: 120 })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('2026-10-09T11:00:00.000Z') })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('invalid') })
    await seedOperation({ repository, environmentId: ENVIRONMENT_ID, startedAt: new Date('2026-10-09T11:10:00.000Z') })

    expect(await useCase.execute()).toBe(3)
    expect(harness.auditCalls.map((call) => call.metadata?.operationId)).toEqual(['operation-1', 'operation-3'])
    expect(harness.logMessages).toContain('Nao foi possivel auditar a operacao de infra interrompida')
  })
})
