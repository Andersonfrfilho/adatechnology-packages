/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTOR_TYPE } from '@adatechnology/infra-contracts'
import { InfraKeepOnUntilRequiredError } from '@adatechnology/infra-contracts'
import { INFRA_OPERATION_LOCK_KEY_PREFIX, INFRA_OPERATION_TRIGGER } from '@adatechnology/infra-contracts'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'
import type { PowerEnvironmentParams } from '@adatechnology/infra-contracts'
import type { InfraScheduleRecord } from '@adatechnology/infra-contracts'

const ENVIRONMENT_ID = 'env-staging'
const HOUR_MS = 3_600_000
const INSIDE_WINDOW = new Date('2026-10-09T12:00:00Z')
// Sabado: dia inativo da agenda comercial.
const OUTSIDE_WINDOW = new Date('2026-10-10T15:00:00Z')

function buildSchedule(overrides: Partial<InfraScheduleRecord> = {}): InfraScheduleRecord {
  return {
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
    createdAt: INSIDE_WINDOW,
    updatedAt: INSIDE_WINDOW,
    ...overrides,
  }
}

function buildHarness(params: { readonly now: Date; readonly schedule?: InfraScheduleRecord }): PowerHarness {
  const harness = buildPowerHarness({
    now: params.now,
    gatewayOptions: {
      projects: [
        buildProject({
          environmentId: ENVIRONMENT_ID,
          environmentName: 'staging',
          services: [buildService({ name: 'web', shape: 'stopped' })],
        }),
      ],
      environmentServices: () => [buildService({ name: 'web' })],
    },
  })
  if (params.schedule) harness.scheduleRepository.seed(params.schedule)
  return harness
}

function buildPowerParams(overrides: Partial<PowerEnvironmentParams> = {}): PowerEnvironmentParams {
  return {
    environmentId: ENVIRONMENT_ID,
    actor: { type: INFRA_AUDIT_ACTOR_TYPE.AGENT, agentId: 'agent-1' },
    trigger: INFRA_OPERATION_TRIGGER.MANUAL,
    ...overrides,
  }
}

async function expectRejectedWithoutTrace(params: {
  readonly harness: PowerHarness
  readonly keepOnUntil?: Date
  readonly messagePart?: string
}): Promise<void> {
  const { harness, keepOnUntil, messagePart } = params
  const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)
  const error = await useCase
    .execute(buildPowerParams(keepOnUntil ? { keepOnUntil } : {}))
    .catch((caught: unknown) => caught)

  expect(error).toBeInstanceOf(InfraKeepOnUntilRequiredError)
  if (messagePart) expect((error as Error).message).toContain(messagePart)
  expect(harness.gateway.events).toEqual([])
  expect(harness.repository.operations).toHaveLength(0)
  expect(harness.cache.setIfAbsentCalls).toHaveLength(0)
  expect(harness.cache.store.has(`${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`)).toBe(false)
  expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
}

describe('PowerEnvironmentUseCase (ligar) - keepOnUntil', () => {
  it('fora da janela sem keepOnUntil recusa antes de qualquer mutation, trava ou operacao', async () => {
    await expectRejectedWithoutTrace({ harness: buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() }) })
  })

  it('fora da janela com keepOnUntil valido grava e liga', async () => {
    const harness = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() })
    const keepOnUntil = new Date(OUTSIDE_WINDOW.getTime() + 2 * HOUR_MS)

    const { operationId } = await new PowerOnEnvironmentUseCase(harness.dependencies).execute(
      buildPowerParams({ keepOnUntil }),
    )

    expect(harness.scheduleRepository.keepOnUntilCalls).toEqual([{ environmentId: ENVIRONMENT_ID, keepOnUntil }])
    expect(harness.repository.operations.map((operation) => operation.id)).toEqual([operationId])
  })

  it('aceita exatamente o limite de 24 h e recusa acima dele', async () => {
    const atLimit = new Date(OUTSIDE_WINDOW.getTime() + 24 * HOUR_MS)
    const accepted = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() })
    await new PowerOnEnvironmentUseCase(accepted.dependencies).execute(buildPowerParams({ keepOnUntil: atLimit }))
    expect(accepted.scheduleRepository.keepOnUntilCalls).toHaveLength(1)

    await expectRejectedWithoutTrace({
      harness: buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() }),
      keepOnUntil: new Date(atLimit.getTime() + 1),
      messagePart: '24 horas',
    })
  })

  it('keepOnUntil no passado ou igual a agora e recusado', async () => {
    await expectRejectedWithoutTrace({
      harness: buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() }),
      keepOnUntil: new Date(OUTSIDE_WINDOW.getTime() - HOUR_MS),
      messagePart: 'futuro',
    })
    await expectRejectedWithoutTrace({
      harness: buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() }),
      keepOnUntil: OUTSIDE_WINDOW,
      messagePart: 'futuro',
    })
  })

  it('dentro da janela ignora keepOnUntil e nao grava', async () => {
    const harness = buildHarness({ now: INSIDE_WINDOW, schedule: buildSchedule() })

    await new PowerOnEnvironmentUseCase(harness.dependencies).execute(
      buildPowerParams({ keepOnUntil: new Date(INSIDE_WINDOW.getTime() + HOUR_MS) }),
    )

    expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
  })

  it('agenda pausada ignora keepOnUntil, mesmo fora da janela', async () => {
    const harness = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule({ isEnabled: false }) })

    await new PowerOnEnvironmentUseCase(harness.dependencies).execute(buildPowerParams())

    expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
  })

  it('sem agenda liga normalmente sem keepOnUntil', async () => {
    const harness = buildHarness({ now: OUTSIDE_WINDOW })

    const { operationId } = await new PowerOnEnvironmentUseCase(harness.dependencies).execute(buildPowerParams())

    expect(operationId).toBeDefined()
    expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
  })

  it('trigger schedule nunca exige nem grava keepOnUntil', async () => {
    const harness = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule() })

    await new PowerOnEnvironmentUseCase(harness.dependencies).execute(
      buildPowerParams({
        trigger: INFRA_OPERATION_TRIGGER.SCHEDULE,
        actor: { type: INFRA_AUDIT_ACTOR_TYPE.SYSTEM },
        keepOnUntil: new Date(OUTSIDE_WINDOW.getTime() + HOUR_MS),
      }),
    )

    expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
  })
})

describe('PowerEnvironmentUseCase (desligar) - keepOnUntil', () => {
  it('desligar manual limpa o keepOnUntil da agenda', async () => {
    const keepOnUntil = new Date(OUTSIDE_WINDOW.getTime() + HOUR_MS)
    const harness = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule({ keepOnUntil }) })

    await new PowerOffEnvironmentUseCase(harness.dependencies).execute(buildPowerParams())

    expect(harness.scheduleRepository.keepOnUntilCalls).toEqual([{ environmentId: ENVIRONMENT_ID, keepOnUntil: null }])
    expect(harness.scheduleRepository.records.get(ENVIRONMENT_ID)?.keepOnUntil).toBeNull()
  })

  it('desligar pelo trigger schedule nao mexe no keepOnUntil', async () => {
    const keepOnUntil = new Date(OUTSIDE_WINDOW.getTime() + HOUR_MS)
    const harness = buildHarness({ now: OUTSIDE_WINDOW, schedule: buildSchedule({ keepOnUntil }) })

    await new PowerOffEnvironmentUseCase(harness.dependencies).execute(
      buildPowerParams({ trigger: INFRA_OPERATION_TRIGGER.SCHEDULE, actor: { type: INFRA_AUDIT_ACTOR_TYPE.SYSTEM } }),
    )

    expect(harness.scheduleRepository.keepOnUntilCalls).toHaveLength(0)
    expect(harness.scheduleRepository.records.get(ENVIRONMENT_ID)?.keepOnUntil).toEqual(keepOnUntil)
  })
})
