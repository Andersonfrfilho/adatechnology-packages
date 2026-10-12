/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { buildPowerHarness } from './testing/buildPowerHarness'
import { RunInfraSchedulesUseCase } from './runInfraSchedules.use-case'

describe('RunInfraSchedulesUseCase - production without a token', () => {
  it('returns before the schedule table, the inventory or any Railway call', async () => {
    const harness = buildPowerHarness({ gatewayOptions: { projects: [] } })
    let resolveCalls = 0
    let listAllCalls = 0
    const scheduleRepository = harness.scheduleRepository
    const originalListAll = scheduleRepository.listAll.bind(scheduleRepository)
    scheduleRepository.listAll = async () => {
      listAllCalls += 1
      return originalListAll()
    }
    const useCase = new RunInfraSchedulesUseCase({
      resolveGateway: async () => {
        resolveCalls += 1
        return undefined
      },
      scheduleRepository,
      powerOnEnvironment: { execute: async () => ({ operationId: 'never' }) },
      powerOffEnvironment: { execute: async () => ({ operationId: 'never' }) },
      logger: { info: () => undefined, error: () => undefined },
      now: () => new Date('2026-10-09T12:00:00.000Z'),
    })

    await useCase.execute()

    expect(resolveCalls).toBe(1)
    expect(listAllCalls).toBe(0)
    expect(harness.gateway.inventoryReads).toBe(0)
    expect(harness.gateway.events).toEqual([])
  })
})
