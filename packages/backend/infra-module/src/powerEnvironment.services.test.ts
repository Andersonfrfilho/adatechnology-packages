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

describe('serviço com mais de um deployment ativo', () => {
  it('para todos os deployments ativos e não deixa o serviço no ar', async () => {
    const postgres = {
      ...buildService({ name: 'Postgres', image: 'postgres:16' }),
      activeDeploymentIds: ['dep-a', 'dep-b'],
    }
    const harness = buildHarness([postgres])
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual(['stop:dep-a', 'stop:dep-b'])
  })

  it('troca a política por nunca, espera o deployment NOVO e para esse quando parar sozinho não derruba', async () => {
    const postgres = buildService({ name: 'Postgres', image: 'postgres:16' })
    const fresh = {
      ...postgres,
      latestDeploymentId: 'dep-new',
      activeDeploymentId: 'dep-new',
      activeDeploymentIds: ['dep-new'],
    }
    const stopped = { ...fresh, isStopped: true, instanceStatus: 'EXITED' }
    const harness: PowerHarness = buildPowerHarness({
      gatewayOptions: {
        projects: [buildProject({ environmentId: ENVIRONMENT_ID, environmentName: 'staging', services: [postgres] })],
        // Antes do redeploy o deployment antigo ainda roda; depois vem o novo; só o stop no novo derruba.
        environmentServices: () => {
          const { events } = harness.gateway
          const redeployedAt = events.findIndex((event) => event.startsWith('redeploy:'))
          if (redeployedAt < 0) return [postgres]
          return events.slice(redeployedAt).includes('stop:dep-new') ? [stopped] : [fresh]
        },
      },
    })
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual([
      'stop:dep-Postgres',
      'policy:NEVER',
      `redeploy:${ENVIRONMENT_ID}/svc-Postgres`,
      'stop:dep-new',
    ])
    expect(harness.repository.operations[0]?.status).toBe('succeeded')
    expect(await harness.cache.get(`infra:restart-policy:${ENVIRONMENT_ID}:svc-Postgres`)).toContain('ON_FAILURE')
  })

  it('não para o deployment antigo quando o novo não aparece no prazo, e falha', async () => {
    const postgres = buildService({ name: 'Postgres', image: 'postgres:16' })
    const harness = buildPowerHarness({
      gatewayOptions: {
        projects: [buildProject({ environmentId: ENVIRONMENT_ID, environmentName: 'staging', services: [postgres] })],
        environmentServices: () => [postgres],
      },
    })
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual([
      'stop:dep-Postgres',
      'policy:NEVER',
      `redeploy:${ENVIRONMENT_ID}/svc-Postgres`,
    ])
    expect(harness.repository.operations[0]?.serviceResults).toEqual([
      { serviceName: 'Postgres', outcome: 'failed', errorCode: 'INFRA_SERVICE_STILL_RUNNING' },
    ])
  })

  it('marca como falha o serviço que segue rodando mesmo depois da política nova', async () => {
    const postgres = buildService({ name: 'Postgres', image: 'postgres:16' })
    const harness = buildPowerHarness({
      gatewayOptions: {
        projects: [buildProject({ environmentId: ENVIRONMENT_ID, environmentName: 'staging', services: [postgres] })],
        environmentServices: () => [postgres],
      },
    })
    const useCase = new PowerOffEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(harness.repository.operations[0]?.status).toBe('failed')
    expect(harness.repository.operations[0]?.serviceResults).toEqual([
      { serviceName: 'Postgres', outcome: 'failed', errorCode: 'INFRA_SERVICE_STILL_RUNNING' },
    ])
  })
})

describe('ligar devolve a política de reinício', () => {
  it('restaura a política guardada e sobe por redeploy', async () => {
    const harness = buildHarness([buildService({ name: 'Postgres', image: 'postgres:16', shape: 'stopped' })])
    await harness.cache.set(
      `infra:restart-policy:${ENVIRONMENT_ID}:svc-Postgres`,
      JSON.stringify({ type: 'ON_FAILURE', maxRetries: 10 }),
    )
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual(['policy:ON_FAILURE', `redeploy:${ENVIRONMENT_ID}/svc-Postgres`])
    expect(await harness.cache.get(`infra:restart-policy:${ENVIRONMENT_ID}:svc-Postgres`)).toBeNull()
  })

  it('sem política guardada, religa do jeito de sempre', async () => {
    const harness = buildHarness([buildService({ name: 'Postgres', image: 'postgres:16', shape: 'stopped' })])
    const useCase = new PowerOnEnvironmentUseCase(harness.dependencies)

    await useCase.execute(manualParams())
    await waitUntilFinished(harness)

    expect(mutationsOf(harness)).toEqual(['restart:dep-Postgres'])
  })
})
