/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import { INFRA_OPERATION_LOCK_KEY_PREFIX, INFRA_OPERATION_TRIGGER } from '@adatechnology/railway-infra-contracts'
import { RailwayRequestFailedError } from '@adatechnology/railway-infra-contracts'
import { type FakeGatewayOptions } from './testing/buildFakeGateway'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { type ServiceShape, buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'
import { RunInfraSchedulesUseCase } from './runInfraSchedules.use-case'
import type { InfraScheduleRecord } from '@adatechnology/railway-infra-contracts'

const MINUTE_MS = 60_000
const MINUTES_PER_DAY = 1440
const ENVIRONMENT_ID = 'env-staging'

type ScenarioEnvironment = {
  readonly id: string
  name: string
  shape: ServiceShape
  isPresent: boolean
}

type Scenario = {
  readonly harness: PowerHarness
  readonly environments: ScenarioEnvironment[]
  readonly clock: { now: Date }
  readonly logs: { readonly level: 'info' | 'error'; readonly message: string }[]
  useCase: RunInfraSchedulesUseCase
  inventoryFailure: ((readNumber: number) => Error | undefined) | undefined
  buildUseCase(overrides?: Partial<ConstructorParameters<typeof RunInfraSchedulesUseCase>[0]>): RunInfraSchedulesUseCase
}

// Instante em Sao Paulo (UTC-3, sem horario de verao): evita depender do fuso da maquina.
function brt(day: number, time: string): Date {
  return new Date(`2026-10-${String(day).padStart(2, '0')}T${time}:00-03:00`)
}

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
    createdAt: brt(1, '00:00'),
    updatedAt: brt(1, '00:00'),
    ...overrides,
  }
}

function serviceNameOf(environmentId: string): string {
  return `web-${environmentId}`
}

function applyMutation(params: {
  readonly environments: readonly ScenarioEnvironment[]
  readonly mutation: string
}): void {
  const [verb, deploymentId] = params.mutation.split(':')
  const target = params.environments.find((entry) => `dep-${serviceNameOf(entry.id)}` === deploymentId)
  if (!target) return
  if (verb === 'stop') target.shape = 'stopped'
  if (verb === 'restart') target.shape = 'running'
}

function buildGatewayOptions(
  environments: readonly ScenarioEnvironment[],
  mutate: (mutation: string) => void,
): FakeGatewayOptions {
  return {
    get projects() {
      return [
        {
          id: 'project-1',
          name: 'ada',
          environments: environments
            .filter((entry) => entry.isPresent)
            .map((entry) => ({
              id: entry.id,
              name: entry.name,
              services: [buildService({ name: serviceNameOf(entry.id), shape: entry.shape })],
            })),
        },
      ]
    },
    failMutation: (mutation) => {
      mutate(mutation)
      return undefined
    },
  }
}

function buildScenario(params: {
  readonly now: Date
  readonly environments?: readonly { readonly id: string; readonly shape: ServiceShape }[]
}): Scenario {
  const environments: ScenarioEnvironment[] = (params.environments ?? [{ id: ENVIRONMENT_ID, shape: 'stopped' }]).map(
    (entry) => ({ id: entry.id, name: 'staging', shape: entry.shape, isPresent: true }),
  )
  const clock = { now: params.now }
  const logs: Scenario['logs'][number][] = []
  const harness = buildPowerHarness({
    gatewayOptions: buildGatewayOptions(environments, (mutation) => applyMutation({ environments, mutation })),
  })
  const dependencies = { ...harness.dependencies, now: () => clock.now }
  const buildUseCase: Scenario['buildUseCase'] = (overrides = {}) =>
    new RunInfraSchedulesUseCase({
      resolveGateway: async () => harness.gateway,
      scheduleRepository: harness.scheduleRepository,
      powerOnEnvironment: new PowerOnEnvironmentUseCase(dependencies),
      powerOffEnvironment: new PowerOffEnvironmentUseCase(dependencies),
      logger: {
        info: (message) => void logs.push({ level: 'info', message }),
        error: (message) => void logs.push({ level: 'error', message }),
      },
      now: () => clock.now,
      ...overrides,
    })
  const scenario: Scenario = {
    harness,
    environments,
    clock,
    logs,
    inventoryFailure: undefined,
    useCase: buildUseCase(),
    buildUseCase,
  }
  installInventoryFailure(scenario)
  return scenario
}

// Envolve a leitura de inventario para que o teste decida qual leitura (tique ou trava do power) falha.
function installInventoryFailure(scenario: Scenario): void {
  const { gateway } = scenario.harness
  const original = gateway.listInventory.bind(gateway)
  let readNumber = 0
  gateway.listInventory = async () => {
    readNumber += 1
    const failure = scenario.inventoryFailure?.(readNumber)
    if (failure) throw failure
    return original()
  }
}

async function flushBackgroundOperations(): Promise<void> {
  await Bun.sleep(0)
}

async function tickAt(params: { readonly scenario: Scenario; readonly at: Date }): Promise<void> {
  params.scenario.clock.now = params.at
  await params.scenario.useCase.execute()
  await flushBackgroundOperations()
}

function seed(scenario: Scenario, overrides: Partial<InfraScheduleRecord> = {}, environmentId = ENVIRONMENT_ID): void {
  scenario.harness.scheduleRepository.seed(buildSchedule({ railwayEnvironmentId: environmentId, ...overrides }))
}

function recordOf(scenario: Scenario, environmentId = ENVIRONMENT_ID): InfraScheduleRecord {
  const record = scenario.harness.scheduleRepository.records.get(environmentId)
  if (!record) throw new Error('schedule not seeded')
  return record
}

describe('RunInfraSchedulesUseCase', () => {
  it('simulates a week minute by minute: exactly 5 power_on and 5 power_off, each once, at the right minutes', async () => {
    const scenario = buildScenario({ now: brt(5, '00:00') })
    seed(scenario)
    const fired: string[] = []
    const start = brt(5, '00:00').getTime()

    for (let minute = 0; minute < 7 * MINUTES_PER_DAY; minute += 1) {
      const before = scenario.harness.repository.operations.length
      await tickAt({ scenario, at: new Date(start + minute * MINUTE_MS) })
      const created = scenario.harness.repository.operations.slice(before)
      for (const operation of created) fired.push(`${scenario.clock.now.toISOString()} ${operation.kind}`)
    }

    const expected = [5, 6, 7, 8, 9].flatMap((day) => [
      `${brt(day, '08:00').toISOString()} power_on`,
      `${brt(day, '20:00').toISOString()} power_off`,
    ])
    expect(fired).toEqual(expected)
    const operations = scenario.harness.repository.operations
    expect(operations.every((operation) => operation.trigger === INFRA_OPERATION_TRIGGER.SCHEDULE)).toBe(true)
    expect(operations.every((operation) => operation.actorAgentId === null)).toBe(true)
    const outcomeAudits = scenario.harness.auditCalls.filter(
      (call) => call.action !== INFRA_AUDIT_ACTION.INFRA_ENVIRONMENT_POWER_REQUESTED,
    )
    expect(outcomeAudits).toHaveLength(10)
    expect(scenario.harness.auditCalls).toHaveLength(20)
    expect(scenario.harness.auditCalls.every((call) => call.actorType === INFRA_AUDIT_ACTOR_TYPE.SYSTEM)).toBe(true)
    expect(scenario.environments[0]?.shape).toBe('stopped')
  }, 120_000)

  it('does not undo a manual power on at 10:00 nor a manual power off at 14:00', async () => {
    const scenario = buildScenario({ now: brt(5, '09:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '08:59') })
    const environment = scenario.environments[0] as ScenarioEnvironment

    for (let minute = 0; minute < 11 * 60; minute += 1) {
      const at = new Date(brt(5, '09:00').getTime() + minute * MINUTE_MS)
      if (at.getTime() === brt(5, '10:00').getTime()) environment.shape = 'running'
      if (at.getTime() === brt(5, '14:00').getTime()) environment.shape = 'stopped'
      await tickAt({ scenario, at })
    }

    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(scenario.harness.gateway.events).toEqual([])
    expect(environment.shape).toBe('stopped')
  }, 60_000)

  it('keeps the environment on until keepOnUntil (22:00) after the 20:00 exit, then powers off and clears it', async () => {
    const scenario = buildScenario({ now: brt(5, '19:59'), environments: [{ id: ENVIRONMENT_ID, shape: 'running' }] })
    seed(scenario, { lastEvaluatedAt: brt(5, '19:58'), keepOnUntil: brt(5, '22:00') })

    for (let minute = 0; minute < 120; minute += 1) {
      await tickAt({ scenario, at: new Date(brt(5, '19:59').getTime() + minute * MINUTE_MS) })
    }
    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(recordOf(scenario).keepOnUntil).toEqual(brt(5, '22:00'))

    await tickAt({ scenario, at: brt(5, '22:00') })

    expect(scenario.harness.repository.operations.map((operation) => operation.kind)).toEqual(['power_off'])
    expect(recordOf(scenario).keepOnUntil).toBeNull()
    expect(recordOf(scenario).lastPowerOffAt).toEqual(brt(5, '22:00'))
  })

  it('does nothing but advances lastEvaluatedAt when the environment is already on at window entry', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00'), environments: [{ id: ENVIRONMENT_ID, shape: 'running' }] })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(scenario.harness.gateway.events).toEqual([])
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '08:00'))
    expect(recordOf(scenario).lastPowerOnAt).toBeNull()
  })

  it('only records the first evaluation (lastEvaluatedAt null)', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario)

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(scenario.harness.gateway.events).toEqual([])
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '08:00'))
  })

  it('does not advance when Railway fails reading the inventory, and fires once when it comes back', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    scenario.inventoryFailure = (readNumber) =>
      readNumber === 1 ? new RailwayRequestFailedError('listInventory') : undefined

    await expect(scenario.useCase.execute()).rejects.toBeInstanceOf(RailwayRequestFailedError)
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '07:59'))
    expect(scenario.harness.gateway.events).toEqual([])

    await tickAt({ scenario, at: brt(5, '08:01') })

    expect(scenario.harness.repository.operations.map((operation) => operation.kind)).toEqual(['power_on'])
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '08:01'))
    await tickAt({ scenario, at: brt(5, '08:02') })
    expect(scenario.harness.repository.operations).toHaveLength(1)
  })

  it('does not advance when Railway fails inside the power use case, logs an error, and retries next minute', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    scenario.inventoryFailure = (readNumber) =>
      readNumber === 2 ? new RailwayRequestFailedError('listInventory') : undefined

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '07:59'))
    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(scenario.logs.some((entry) => entry.level === 'error')).toBe(true)

    await tickAt({ scenario, at: brt(5, '08:01') })

    expect(scenario.harness.repository.operations.map((operation) => operation.kind)).toEqual(['power_on'])
  })

  it('retries next tick, without error, when the lock is busy', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    const lockKey = `${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`
    scenario.harness.cache.store.set(lockKey, 'held')

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.logs.filter((entry) => entry.level === 'error')).toHaveLength(0)
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '07:59'))
    expect(scenario.harness.repository.operations).toHaveLength(0)

    scenario.harness.cache.store.delete(lockKey)
    await tickAt({ scenario, at: brt(5, '08:01') })

    expect(scenario.harness.repository.operations).toHaveLength(1)
  })

  it('fires only one operation when the same minute is evaluated twice', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })

    await tickAt({ scenario, at: brt(5, '08:00') })
    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.repository.operations).toHaveLength(1)
  })

  it('lets the Redis lock absorb two concurrent ticks that read the same stale evaluation', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })

    await Promise.all([scenario.useCase.execute(), scenario.useCase.execute()])
    await flushBackgroundOperations()

    expect(scenario.harness.repository.operations).toHaveLength(1)
    expect(scenario.logs.filter((entry) => entry.level === 'error')).toHaveLength(0)
  })

  it('never acts on an environment renamed to production, but advances the evaluation', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    ;(scenario.environments[0] as ScenarioEnvironment).name = 'production'

    await tickAt({ scenario, at: brt(5, '08:00') })
    await tickAt({ scenario, at: brt(5, '08:01') })

    expect(scenario.harness.gateway.events).toEqual([])
    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '08:01'))
  })

  it('does not act, but advances, when the environment was deleted from the inventory', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    ;(scenario.environments[0] as ScenarioEnvironment).isPresent = false

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.gateway.events).toEqual([])
    expect(scenario.harness.repository.operations).toHaveLength(0)
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '08:00'))
  })

  it('ignores a paused schedule without touching Railway', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59'), isEnabled: false })

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.gateway.inventoryReads).toBe(0)
    expect(scenario.harness.scheduleRepository.evaluationCalls).toHaveLength(0)
    expect(scenario.harness.repository.operations).toHaveLength(0)
  })

  it('reads the inventory zero times when every active schedule resolves to none, but still records the evaluation', async () => {
    const scenario = buildScenario({ now: brt(5, '10:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '09:59') })

    await tickAt({ scenario, at: brt(5, '10:00') })

    expect(scenario.harness.gateway.inventoryReads).toBe(0)
    expect(recordOf(scenario).lastEvaluatedAt).toEqual(brt(5, '10:00'))
  })

  it('reads the inventory once when at least one schedule has an action', async () => {
    const scenario = buildScenario({
      now: brt(5, '08:00'),
      environments: [
        { id: 'env-a', shape: 'stopped' },
        { id: 'env-b', shape: 'stopped' },
      ],
    })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') }, 'env-a')
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59'), id: 'schedule-2', powerOnTime: '09:00' }, 'env-b')
    const useCase = scenario.buildUseCase({
      powerOnEnvironment: { execute: async () => ({ operationId: 'fake' }) },
    })

    await useCase.execute()

    expect(scenario.harness.gateway.inventoryReads).toBe(1)
  })

  it('does not call the gateway at all when there are no schedules', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })

    await tickAt({ scenario, at: brt(5, '08:00') })

    expect(scenario.harness.gateway.inventoryReads).toBe(0)
    expect(scenario.harness.gateway.events).toEqual([])
  })

  it('does nothing when the gateway is not configured', async () => {
    const scenario = buildScenario({ now: brt(5, '08:00') })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') })
    const useCase = new RunInfraSchedulesUseCase({
      resolveGateway: async () => undefined,
      scheduleRepository: scenario.harness.scheduleRepository,
      powerOnEnvironment: { execute: async () => ({ operationId: 'never' }) },
      powerOffEnvironment: { execute: async () => ({ operationId: 'never' }) },
      logger: { info: () => undefined, error: () => undefined },
      now: () => brt(5, '08:00'),
    })

    await useCase.execute()

    expect(scenario.harness.scheduleRepository.evaluationCalls).toHaveLength(0)
  })

  it('isolates schedules: a failure on one does not stop the others and does not advance it', async () => {
    const scenario = buildScenario({
      now: brt(5, '08:00'),
      environments: [
        { id: 'env-a', shape: 'stopped' },
        { id: 'env-b', shape: 'stopped' },
      ],
    })
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59') }, 'env-a')
    seed(scenario, { lastEvaluatedAt: brt(5, '07:59'), id: 'schedule-2' }, 'env-b')
    const useCase = scenario.buildUseCase({
      powerOnEnvironment: {
        execute: async (params) => {
          if (params.environmentId === 'env-a') throw new Error('database down')
          return { operationId: `ok-${params.environmentId}` }
        },
      },
    })

    await useCase.execute()

    expect(recordOf(scenario, 'env-a').lastEvaluatedAt).toEqual(brt(5, '07:59'))
    expect(recordOf(scenario, 'env-b').lastEvaluatedAt).toEqual(brt(5, '08:00'))
    expect(recordOf(scenario, 'env-b').lastPowerOnAt).toEqual(brt(5, '08:00'))
    expect(scenario.logs.some((entry) => entry.level === 'error')).toBe(true)
  })
})
