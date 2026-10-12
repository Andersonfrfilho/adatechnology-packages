/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { InfraServiceNotFoundError } from '@adatechnology/infra-contracts'
import type { PowerEnvironmentParams } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

import { buildPowerHarness, type PowerHarness } from './testing/buildPowerHarness'
import { buildProject } from './testing/buildProject'
import { buildService } from './testing/buildService'
import { PowerOffEnvironmentUseCase } from './powerOffEnvironment.use-case'
import { PowerOnEnvironmentUseCase } from './powerOnEnvironment.use-case'

const ENVIRONMENT_ID = 'env-staging'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'

function buildHarness(services: readonly InfraServiceInstance[]): PowerHarness {
  return buildPowerHarness({
    gatewayOptions: {
      projects: [buildProject({ environmentId: ENVIRONMENT_ID, environmentName: 'staging', services })],
    },
  })
}

function manualParams(overrides: Partial<PowerEnvironmentParams> = {}): PowerEnvironmentParams {
  return { environmentId: ENVIRONMENT_ID, actor: { type: 'agent', agentId: AGENT_ID }, trigger: 'manual', ...overrides }
}

async function waitUntilFinished(harness: PowerHarness): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (harness.repository.operations.every((operation) => operation.status !== 'running')) return
    await Bun.sleep(1)
  }
  throw new Error('operation did not finish')
}

function mutationsOf(harness: PowerHarness): string[] {
  return harness.gateway.events.filter((event) => event !== 'read')
}

describe('desligar só alguns serviços', () => {
  const services = [
    buildService({ name: 'web' }),
    buildService({ name: 'worker' }),
    buildService({ name: 'Postgres', image: 'postgres:16' }),
  ]

  it('para apenas o serviço escolhido e deixa o resto rodando', async () => {
    const harness = buildHarness(services)
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams({ serviceIds: ['svc-worker'] }))
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual(['stop:dep-worker'])
    expect(harness.repository.operations[0]?.serviceResults).toEqual([{ serviceName: 'worker', outcome: 'ok' }])
  })

  it('recusa um serviço que não é do ambiente, sem operação, sem trava e sem mudança', async () => {
    const harness = buildHarness(services)
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await expect(useCase.execute(manualParams({ serviceIds: ['svc-web', 'svc-other'] }))).rejects.toBeInstanceOf(
      InfraServiceNotFoundError,
    )

    expect(mutationsOf(harness)).toEqual([])
    expect(harness.repository.operations).toEqual([])
    expect(harness.cache.setIfAbsentCalls).toEqual([])
  })

  it('não limpa o keepOnUntil da agenda quando a seleção é parcial', async () => {
    const harness = buildHarness(services)
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams({ serviceIds: ['svc-web'] }))
    await waitUntilFinished(harness)

    expect(harness.scheduleRepository.keepOnUntilCalls).toEqual([])
  })

  it('registra os ids na trilha de auditoria', async () => {
    const harness = buildHarness(services)
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams({ serviceIds: ['svc-web'] }))
    await waitUntilFinished(harness)

    const requested = harness.auditCalls.find((entry) => entry.action === 'infra.environment_power_requested')
    expect(requested?.metadata).toMatchObject({ serviceIds: ['svc-web'] })
  })
})

describe('ligar só alguns serviços', () => {
  it('liga a aplicação escolhida quando o banco do ambiente já está rodando', async () => {
    const harness = buildHarness([
      buildService({ name: 'web', shape: 'stopped' }),
      buildService({ name: 'worker', shape: 'stopped' }),
      buildService({ name: 'Postgres', image: 'postgres:16' }),
    ])
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams({ serviceIds: ['svc-web'] }))
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual(['restart:dep-web'])
  })

  it('não liga a aplicação se um banco do ambiente fora da seleção está parado', async () => {
    const harness = buildHarness([
      buildService({ name: 'web', shape: 'stopped' }),
      buildService({ name: 'Postgres', image: 'postgres:16', shape: 'stopped' }),
    ])
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams({ serviceIds: ['svc-web'] }))
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual([])
    expect(harness.repository.operations[0]?.serviceResults).toEqual([{ serviceName: 'web', outcome: 'skipped' }])
  })
})
