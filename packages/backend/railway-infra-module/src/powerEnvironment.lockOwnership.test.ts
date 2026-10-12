/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_OPERATION_LOCK_KEY_PREFIX } from '@adatechnology/railway-infra-contracts'
import { type PowerHarness, buildPowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import type { PowerEnvironmentParams } from '@adatechnology/railway-infra-contracts'

const ENVIRONMENT_ID = '22222222-2222-4222-8222-222222222222'
const LOCK_KEY = `${INFRA_OPERATION_LOCK_KEY_PREFIX}${ENVIRONMENT_ID}`
const OTHER_OWNER = 'owner-of-operation-b'

function buildHarness(gate?: Promise<void>): {
  readonly harness: PowerHarness
  readonly useCase: PowerOffEnvironmentUseCase
} {
  const harness = buildPowerHarness({
    gatewayOptions: {
      projects: [
        buildProject({
          environmentId: ENVIRONMENT_ID,
          environmentName: 'staging',
          services: [buildService({ name: 'web' }), buildService({ name: 'worker' })],
        }),
      ],
      ...(gate ? { gate } : {}),
    },
  })
  return { harness, useCase: new PowerOffEnvironmentUseCase(harness.dependencies) }
}

function manualParams(): PowerEnvironmentParams {
  return { environmentId: ENVIRONMENT_ID, actor: { type: 'agent', agentId: 'agent-1' }, trigger: 'manual' }
}

async function waitUntilFinished(harness: PowerHarness): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (harness.repository.operations.every((operation) => operation.status !== 'running')) return
    await Bun.sleep(1)
  }
  throw new Error('operation did not finish')
}

describe('PowerEnvironmentUseCase - lock ownership', () => {
  it('stores a random per-operation identifier as the lock value, not a timestamp', async () => {
    const { harness, useCase } = buildHarness()

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)
    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    const [first, second] = harness.cache.setIfAbsentCalls.map((call) => call.value)
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(second).not.toBe(first)
  })

  it('leaves operation B lock intact when A outlives its TTL, then renews and releases', async () => {
    let openGate: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    const { harness, useCase } = buildHarness(gate)

    await useCase.execute(manualParams())
    const ownerOfA = harness.cache.store.get(LOCK_KEY)
    harness.cache.expire(LOCK_KEY)
    const isBAcquired = await harness.cache.setIfAbsent({ key: LOCK_KEY, value: OTHER_OWNER, ttlSeconds: 720 })
    expect(isBAcquired).toBe(true)

    openGate()
    await waitUntilFinished(harness)

    expect(harness.cache.store.get(LOCK_KEY)).toBe(OTHER_OWNER)
    expect(harness.cache.renewCalls.length).toBeGreaterThan(0)
    expect(harness.cache.renewCalls.every((call) => call.owner === ownerOfA)).toBe(true)
    expect(harness.cache.releaseCalls).toEqual([{ key: LOCK_KEY, owner: ownerOfA ?? '' }])
    expect(harness.logMessages).toContain('Trava da operacao de infra nao pertence mais a esta operacao')
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
  })

  it('does not recreate an expired lock when A renews after the TTL', async () => {
    let openGate: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    const { harness, useCase } = buildHarness(gate)

    await useCase.execute(manualParams())
    harness.cache.expire(LOCK_KEY)
    openGate()
    await waitUntilFinished(harness)

    expect(harness.cache.store.has(LOCK_KEY)).toBe(false)
    expect(harness.cache.setCalls.filter((call) => call.key === LOCK_KEY)).toEqual([])
  })
})
