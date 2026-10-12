/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTION } from '@adatechnology/infra-contracts'
import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_ACCESS_STATUS,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  type InfraAccessStatus,
} from '@adatechnology/infra-contracts'
import { InfraNotConfiguredError } from '@adatechnology/infra-contracts'
import {
  INTEGRATION_AGENT_ID,
  INTEGRATION_IP_ADDRESS,
  buildCountingGateway,
  buildIntegrationHarness,
} from './testing/buildIntegrationHarness'
import { expectNoIntegrationLeak } from './testing/expectNoIntegrationLeak'
import { VerifyInfraIntegrationUseCase } from './verifyInfraIntegration.use-case'

const PARAMS = { actor: { agentId: INTEGRATION_AGENT_ID }, ipAddress: INTEGRATION_IP_ADDRESS }

function buildScenario(access: InfraAccessStatus) {
  const harness = buildIntegrationHarness()
  const { gateway, counter } = buildCountingGateway(access)
  harness.provider.gateway = gateway
  const useCase = new VerifyInfraIntegrationUseCase(harness.dependencies)
  return { harness, counter, useCase }
}

describe('VerifyInfraIntegrationUseCase', () => {
  it('sem gateway lanca nao configurado e nao audita', async () => {
    const harness = buildIntegrationHarness()
    const caught = await new VerifyInfraIntegrationUseCase(harness.dependencies).execute(PARAMS).then(
      () => undefined,
      (e: unknown) => e,
    )

    expect(caught).toBeInstanceOf(InfraNotConfiguredError)
    expect(harness.auditCalls).toEqual([])
  })

  it('segunda chamada em 30 s nao chama o Railway, mas audita as duas', async () => {
    const { harness, counter, useCase } = buildScenario(INFRA_ACCESS_STATUS.OK)

    const first = await useCase.execute(PARAMS)
    const second = await useCase.execute(PARAMS)

    expect(first).toEqual({ access: 'ok' })
    expect(second).toEqual({ access: 'ok' })
    expect(counter.verifyCalls).toBe(1)
    expect(harness.cache.setCalls).toContainEqual({ key: INFRA_INTEGRATION_VERIFY_CACHE_KEY, ttlSeconds: 30 })
    expect(harness.auditCalls.length).toBe(2)
  })

  it('depois de expirar o veredito, chama o Railway de novo', async () => {
    const { harness, counter, useCase } = buildScenario(INFRA_ACCESS_STATUS.OK)

    await useCase.execute(PARAMS)
    harness.cache.expire(INFRA_INTEGRATION_VERIFY_CACHE_KEY)
    await useCase.execute(PARAMS)

    expect(counter.verifyCalls).toBe(2)
  })

  const TTL_BY_STATUS: readonly [InfraAccessStatus, number | undefined][] = [
    [INFRA_ACCESS_STATUS.OK, 300],
    [INFRA_ACCESS_STATUS.BILLING_UNAVAILABLE, 300],
    [INFRA_ACCESS_STATUS.TOKEN_INVALID, 60],
    [INFRA_ACCESS_STATUS.UNAVAILABLE, undefined],
  ]
  for (const [status, ttl] of TTL_BY_STATUS) {
    it(`grava infra:access com o TTL do status ${status}`, async () => {
      const { harness, useCase } = buildScenario(status)
      await useCase.execute(PARAMS)

      const writes = harness.cache.setCalls.filter((call) => call.key === INFRA_ACCESS_CACHE_KEY)
      expect(writes.map((call) => call.ttlSeconds)).toEqual(ttl === undefined ? [] : [ttl])
      expect(harness.cache.store.get(INFRA_ACCESS_CACHE_KEY)).toBe(ttl === undefined ? undefined : status)
    })
  }

  it('audita verified_ok e verified_failed com metadata fechada e sem vazar', async () => {
    const ok = buildScenario(INFRA_ACCESS_STATUS.OK)
    const failed = buildScenario(INFRA_ACCESS_STATUS.TOKEN_INVALID)
    const okResult = await ok.useCase.execute(PARAMS)
    const failedResult = await failed.useCase.execute(PARAMS)

    expect(ok.harness.auditCalls.map((entry) => [entry.action, entry.metadata])).toEqual([
      [INFRA_AUDIT_ACTION.INFRA_INTEGRATION_VERIFIED, { reason: 'verified_ok' }],
    ])
    expect(failed.harness.auditCalls.map((entry) => [entry.action, entry.metadata])).toEqual([
      [INFRA_AUDIT_ACTION.INFRA_INTEGRATION_VERIFIED, { reason: 'verified_failed' }],
    ])
    expectNoIntegrationLeak({ harness: ok.harness, observed: [okResult] })
    expectNoIntegrationLeak({ harness: failed.harness, observed: [failedResult] })
  })

  it('veredito em cache invalido e ignorado', async () => {
    const { harness, counter, useCase } = buildScenario(INFRA_ACCESS_STATUS.OK)
    harness.cache.store.set(INFRA_INTEGRATION_VERIFY_CACHE_KEY, '{"access":"ok"}')

    await useCase.execute(PARAMS)

    expect(counter.verifyCalls).toBe(1)
  })
})
