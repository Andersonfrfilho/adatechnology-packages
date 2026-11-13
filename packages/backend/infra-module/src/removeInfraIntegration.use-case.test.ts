/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/infra-contracts'
import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  INFRA_INVENTORY_CACHE_KEY,
} from '@adatechnology/infra-contracts'
import {
  InfraIntegrationEnvironmentManagedError,
  InfraIntegrationLockedError,
  InfraIntegrationPasswordInvalidError,
  InfraIntegrationProductionOnlyError,
} from '@adatechnology/infra-contracts'
import {
  INTEGRATION_AGENT_ID,
  INTEGRATION_IP_ADDRESS,
  INTEGRATION_PASSWORD,
  buildIntegrationHarness,
  type IntegrationHarness,
  type IntegrationHarnessOptions,
} from './testing/buildIntegrationHarness'
import { buildRecord } from './testing/buildProviderHarness'
import { expectNoIntegrationLeak } from './testing/expectNoIntegrationLeak'
import { RemoveInfraIntegrationUseCase } from './removeInfraIntegration.use-case'

const PARAMS = {
  actor: { agentId: INTEGRATION_AGENT_ID },
  ipAddress: INTEGRATION_IP_ADDRESS,
  password: INTEGRATION_PASSWORD,
}
const FIVE_CACHE_KEYS = [
  INFRA_INVENTORY_CACHE_KEY,
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
]

function buildSeeded(options?: IntegrationHarnessOptions): IntegrationHarness {
  const harness = buildIntegrationHarness(options)
  harness.repository.seed(buildRecord())
  for (const key of FIVE_CACHE_KEYS) harness.cache.store.set(key, 'x')
  return harness
}

async function expectRefusal(harness: IntegrationHarness, error: new (...args: never[]) => Error, reason: string) {
  const caught = await new RemoveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS).then(
    () => undefined,
    (e: unknown) => e,
  )

  expect(caught).toBeInstanceOf(error)
  expect(harness.repository.deleteCalls).toBe(0)
  expect(harness.repository.records.size).toBe(1)
  expect(harness.provider.invalidations).toBe(0)
  expect(harness.cache.deletedKeys).toEqual([])
  expect(harness.auditCalls.map((entry) => [entry.action, entry.metadata])).toEqual([
    [INFRA_AUDIT_ACTION.INFRA_INTEGRATION_DENIED, { reason }],
  ])
  expectNoIntegrationLeak({ harness, observed: [caught] })
}

describe('RemoveInfraIntegrationUseCase', () => {
  it('fora de producao recusa antes da senha', async () => {
    const harness = buildSeeded({ config: { env: 'staging' } })
    await expectRefusal(harness, InfraIntegrationProductionOnlyError, 'production_only')
    expect(harness.passwordCalls).toEqual([])
  })

  it('token da variavel de ambiente: 409 environment_managed, antes da senha', async () => {
    const harness = buildSeeded({ config: { environmentToken: 'valor-qualquer-1234' } })
    await expectRefusal(harness, InfraIntegrationEnvironmentManagedError, 'environment_managed')
    expect(harness.passwordCalls).toEqual([])
  })

  it('senha errada nao apaga nada', async () => {
    const harness = buildSeeded()
    harness.state.passwordResult = { outcome: 'invalid' }
    await expectRefusal(harness, InfraIntegrationPasswordInvalidError, 'password_invalid')
  })

  it('bloqueio novo audita integration_locked e nao apaga', async () => {
    const harness = buildSeeded()
    harness.state.passwordResult = { outcome: 'locked', retryAfterSeconds: 900, isNewLock: true }
    const caught = await new RemoveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS).then(
      () => undefined,
      (e: unknown) => e,
    )

    expect(caught).toBeInstanceOf(InfraIntegrationLockedError)
    expect(harness.repository.deleteCalls).toBe(0)
    expect(harness.auditCalls.map((entry) => entry.action)).toEqual([INFRA_AUDIT_ACTION.INFRA_INTEGRATION_LOCKED])
  })

  it('sucesso apaga a linha, invalida, apaga as chaves e audita removed', async () => {
    const harness = buildSeeded()
    harness.provider.description = { source: 'none', state: 'not_configured', environmentTokenAlsoPresent: false }
    const result = await new RemoveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(harness.repository.records.size).toBe(0)
    expect(harness.provider.invalidations).toBe(1)
    expect(harness.cache.store.size).toBe(0)
    for (const key of FIVE_CACHE_KEYS) expect(harness.cache.deletedKeys).toContain(key)
    expect(result).toEqual({ source: 'none', state: 'not_configured', environmentTokenAlsoPresent: false })
    expect(harness.auditCalls).toEqual([
      {
        actorType: INFRA_AUDIT_ACTOR_TYPE.AGENT,
        actorId: INTEGRATION_AGENT_ID,
        ipAddress: INTEGRATION_IP_ADDRESS,
        action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_REMOVED,
        targetType: INFRA_AUDIT_TARGET.INFRA_INTEGRATION,
        metadata: { reason: 'removed', source: 'panel' },
      },
    ])
    expectNoIntegrationLeak({ harness, observed: [result] })
  })

  it('sem linha: idempotente, estado not_configured, nada invalidado nem auditado', async () => {
    const harness = buildIntegrationHarness()
    const result = await new RemoveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(result).toEqual({ source: 'none', state: 'not_configured', environmentTokenAlsoPresent: false })
    expect(harness.repository.deleteCalls).toBe(1)
    expect(harness.provider.invalidations).toBe(0)
    expect(harness.cache.deletedKeys).toEqual([])
    expect(harness.auditCalls).toEqual([])
  })

  it('falha de cache e de auditoria so loga: a remocao fica valendo', async () => {
    const harness = buildSeeded()
    harness.cache.failDelete = true
    harness.state.failAudit = true
    await new RemoveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(harness.repository.records.size).toBe(0)
    expect(harness.provider.invalidations).toBe(1)
    expectNoIntegrationLeak({ harness, observed: [] })
  })
})
