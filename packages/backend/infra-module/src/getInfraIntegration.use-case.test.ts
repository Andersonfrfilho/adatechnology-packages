/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_ACCESS_CACHE_KEY } from '@adatechnology/infra-contracts'
import { FakeInfraCache } from './testing/FakeInfraCache'
import { FakeGatewayProvider } from './testing/buildIntegrationHarness'
import { DECOY_TOKEN, WORKSPACE_ID } from './testing/buildProviderHarness'
import { GetInfraIntegrationUseCase } from './getInfraIntegration.use-case'
import { FAKE_NOW } from './testing/fakeNow.constant'
import type { InfraIntegrationDescription } from '@adatechnology/infra-contracts'

const PANEL: InfraIntegrationDescription = {
  source: 'panel',
  state: 'configured',
  workspaceId: WORKSPACE_ID,
  tokenHint: '6789',
  updatedAt: FAKE_NOW,
  updatedByAgentId: 'agent-1',
  environmentTokenAlsoPresent: false,
}

function buildScenario(
  description: InfraIntegrationDescription,
  findAgentName?: (id: string) => Promise<string | undefined>,
) {
  const provider = new FakeGatewayProvider([])
  provider.description = description
  const cache = new FakeInfraCache()
  const useCase = new GetInfraIntegrationUseCase({
    gatewayProvider: provider,
    cache,
    ...(findAgentName ? { findAgentName } : {}),
  })
  return { provider, cache, useCase }
}

describe('GetInfraIntegrationUseCase', () => {
  it('devolve so estado: sem token, cifrado nem keyId, com o nome de quem alterou', async () => {
    const { useCase } = buildScenario({ ...PANEL }, async () => 'Ana Admin')
    const result = await useCase.execute()

    expect(result).toEqual({
      source: 'panel',
      state: 'configured',
      workspaceId: WORKSPACE_ID,
      tokenHint: '6789',
      updatedAt: FAKE_NOW,
      updatedByName: 'Ana Admin',
      environmentTokenAlsoPresent: false,
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(DECOY_TOKEN)
    for (const forbidden of ['ciphertext', 'keyId', 'updatedByAgentId']) expect(serialized).not.toContain(forbidden)
  })

  it('access vem do cache, sem chamar o Railway', async () => {
    const { cache, provider, useCase } = buildScenario({ ...PANEL })
    cache.store.set(INFRA_ACCESS_CACHE_KEY, 'token_invalid')

    expect((await useCase.execute()).access).toBe('token_invalid')
    expect(provider.resolveCalls).toBe(0)
  })

  it('access invalido (JSON, lixo) ou ausente fica de fora', async () => {
    const { cache, useCase } = buildScenario({ ...PANEL })
    expect('access' in (await useCase.execute())).toBe(false)
    for (const raw of ['"ok"', '{"access":"ok"}', 'banana', '']) {
      cache.store.set(INFRA_ACCESS_CACHE_KEY, raw)
      expect('access' in (await useCase.execute())).toBe(false)
    }
  })

  it('sem findAgentName ou sem agente nao ha nome', async () => {
    const withoutFinder = await buildScenario({ ...PANEL }).useCase.execute()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedByAgentId: _omitted, ...withoutAgent } = PANEL
    const withoutAgentResult = await buildScenario(withoutAgent, async () => 'Ana').useCase.execute()

    expect('updatedByName' in withoutFinder).toBe(false)
    expect('updatedByName' in withoutAgentResult).toBe(false)
  })

  it('fonte ambiente avisa que existe linha do painel ignorada', async () => {
    const { useCase } = buildScenario({
      source: 'environment',
      state: 'configured',
      workspaceId: WORKSPACE_ID,
      environmentTokenAlsoPresent: true,
    })

    expect(await useCase.execute()).toEqual({
      source: 'environment',
      state: 'configured',
      workspaceId: WORKSPACE_ID,
      environmentTokenAlsoPresent: true,
    })
  })

  it('estado nao configurado nao tem dica nem workspace', async () => {
    const { useCase } = buildScenario({ source: 'none', state: 'not_configured', environmentTokenAlsoPresent: false })

    expect(await useCase.execute()).toEqual({
      source: 'none',
      state: 'not_configured',
      environmentTokenAlsoPresent: false,
    })
  })
})
