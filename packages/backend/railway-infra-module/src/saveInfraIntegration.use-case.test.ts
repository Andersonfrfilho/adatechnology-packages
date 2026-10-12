/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/railway-infra-contracts'
import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  INFRA_INVENTORY_CACHE_KEY,
} from '@adatechnology/railway-infra-contracts'
import {
  INTEGRATION_AGENT_ID,
  INTEGRATION_IP_ADDRESS,
  INTEGRATION_PASSWORD,
  buildIntegrationHarness,
  type IntegrationHarness,
} from './testing/buildIntegrationHarness'
import { DECOY_TOKEN, KEY_BASE64, WORKSPACE_ID } from './testing/buildProviderHarness'
import { expectNoIntegrationLeak } from './testing/expectNoIntegrationLeak'
import { openSecret } from './infraSecretCipher'
import { loadInfraSecretKey } from './infraSecretKey'
import { SaveInfraIntegrationUseCase } from './saveInfraIntegration.use-case'

const FOUR_CACHE_KEYS = [
  INFRA_INVENTORY_CACHE_KEY,
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
]
const PARAMS = {
  actor: { agentId: INTEGRATION_AGENT_ID },
  ipAddress: INTEGRATION_IP_ADDRESS,
  token: DECOY_TOKEN,
  password: INTEGRATION_PASSWORD,
}

function seedCaches(harness: IntegrationHarness): void {
  for (const key of [...FOUR_CACHE_KEYS, INFRA_INTEGRATION_VERIFY_CACHE_KEY]) harness.cache.store.set(key, 'x')
}

describe('SaveInfraIntegrationUseCase: sucesso', () => {
  it('primeira vez audita configured; a segunda audita replaced', async () => {
    const harness = buildIntegrationHarness()
    const useCase = new SaveInfraIntegrationUseCase(harness.dependencies)

    await useCase.execute(PARAMS)
    await useCase.execute(PARAMS)

    const [first, second] = harness.auditCalls
    expect(harness.auditCalls.length).toBe(2)
    expect(first).toEqual({
      actorType: INFRA_AUDIT_ACTOR_TYPE.AGENT,
      actorId: INTEGRATION_AGENT_ID,
      ipAddress: INTEGRATION_IP_ADDRESS,
      action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_CONFIGURED,
      targetType: INFRA_AUDIT_TARGET.INFRA_INTEGRATION,
      targetId: 'integration-1',
      metadata: { reason: 'configured', source: 'panel', workspaceId: WORKSPACE_ID },
    })
    expect(second?.action).toBe(INFRA_AUDIT_ACTION.INFRA_INTEGRATION_REPLACED)
    expect(second?.metadata).toEqual({ reason: 'replaced', source: 'panel', workspaceId: WORKSPACE_ID })
  })

  it('grava cifrado (nunca a isca), abrivel com a chave, com os 4 ultimos caracteres como dica', async () => {
    const harness = buildIntegrationHarness()
    await new SaveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    const record = harness.repository.records.get('railway')
    const key = loadInfraSecretKey(KEY_BASE64)
    expect(record?.ciphertext).not.toBe(DECOY_TOKEN)
    expect(record?.ciphertext).not.toContain(DECOY_TOKEN)
    expect(openSecret({ sealed: record?.ciphertext ?? '', key, provider: 'railway', workspaceId: WORKSPACE_ID })).toBe(
      DECOY_TOKEN,
    )
    expect(record?.tokenHint).toBe('6789')
    expect(record?.keyId).toBe(key.keyId)
    expect(record?.updatedByAgentId).toBe(INTEGRATION_AGENT_ID)
  })

  it('invalida o provedor e apaga as quatro chaves de cache (e o veredito de verify)', async () => {
    const harness = buildIntegrationHarness()
    seedCaches(harness)
    await new SaveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(harness.provider.invalidations).toBe(1)
    for (const key of FOUR_CACHE_KEYS) expect(harness.cache.deletedKeys).toContain(key)
    expect(harness.cache.deletedKeys).toContain(INFRA_INTEGRATION_VERIFY_CACHE_KEY)
    expect(harness.cache.store.size).toBe(0)
  })

  it('senha, probe, gravacao e invalidacao, nessa ordem', async () => {
    const harness = buildIntegrationHarness()
    await new SaveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(harness.events).toEqual(['password', 'probe', 'write', 'invalidate'])
  })

  it('falha da auditoria ou do cache so loga e nao desfaz o save', async () => {
    const harness = buildIntegrationHarness()
    harness.state.failAudit = true
    harness.cache.failDelete = true
    const result = await new SaveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(harness.repository.records.size).toBe(1)
    expect(harness.provider.invalidations).toBe(1)
    expect(harness.logs.length).toBeGreaterThanOrEqual(2)
    expectNoIntegrationLeak({ harness, observed: [result] })
  })

  it('devolve so a visao de estado e nunca vaza a isca, a senha nem o cifrado', async () => {
    const harness = buildIntegrationHarness()
    harness.provider.description = {
      source: 'panel',
      state: 'configured',
      workspaceId: WORKSPACE_ID,
      tokenHint: '6789',
      environmentTokenAlsoPresent: false,
    }
    const result = await new SaveInfraIntegrationUseCase(harness.dependencies).execute(PARAMS)

    expect(result).toEqual({
      source: 'panel',
      state: 'configured',
      workspaceId: WORKSPACE_ID,
      tokenHint: '6789',
      environmentTokenAlsoPresent: false,
    })
    expect(Object.keys(result)).not.toContain('keyId')
    expectNoIntegrationLeak({ harness, observed: [result] })
  })
})
