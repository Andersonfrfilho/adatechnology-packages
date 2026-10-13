/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { INFRA_POWER_DIRECTION } from '@adatechnology/infra-contracts'
import { RunPowerOperation } from './runPowerOperation'
import type { InfraPowerDirection } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'

const ENVIRONMENT_ID = 'env-staging'

function buildWebService(overrides: Partial<InfraServiceInstance>): InfraServiceInstance {
  return {
    serviceId: 'svc-web',
    serviceName: 'web',
    hasDeployment: true,
    isStopped: false,
    instanceStatus: 'RUNNING',
    ...overrides,
  }
}

async function run(direction: InfraPowerDirection, service: InfraServiceInstance): Promise<readonly string[]> {
  const mutations: string[] = []
  const gateway = {
    getEnvironmentServices: async () => [],
    removeDeployment: async () => undefined,
    getRestartPolicy: async () => ({ type: 'ON_FAILURE' }),
    setRestartPolicy: async () => undefined,
    stopDeployment: async ({ deploymentId }: { deploymentId: string }) => void mutations.push(`stop:${deploymentId}`),
    restartDeployment: async ({ deploymentId }: { deploymentId: string }) =>
      void mutations.push(`restart:${deploymentId}`),
    redeployService: async ({ serviceId }: { serviceId: string }) => void mutations.push(`redeploy:${serviceId}`),
  } as unknown as InfraGatewayInterface
  const operation = new RunPowerOperation({ gateway, sleep: async () => undefined, databaseWaitSeconds: 10 })

  await operation.execute({
    direction,
    environmentId: ENVIRONMENT_ID,
    services: [service],
    onProgress: async () => undefined,
  })
  return mutations
}

describe('RunPowerOperation (deployment alvo)', () => {
  it('desligar mira o deployment ATIVO quando difere do ultimo', async () => {
    const mutations = await run(
      INFRA_POWER_DIRECTION.OFF,
      buildWebService({ latestDeploymentId: 'dep-new', activeDeploymentId: 'dep-old' }),
    )

    expect(mutations).toEqual(['stop:dep-old'])
  })

  it('desligar sem ativo mira o ultimo', async () => {
    const mutations = await run(INFRA_POWER_DIRECTION.OFF, buildWebService({ latestDeploymentId: 'dep-last' }))

    expect(mutations).toEqual(['stop:dep-last'])
  })

  it('religar reinicia o deployment ATIVO parado', async () => {
    const mutations = await run(
      INFRA_POWER_DIRECTION.ON,
      buildWebService({
        latestDeploymentId: 'dep-new',
        activeDeploymentId: 'dep-old',
        isStopped: true,
        instanceStatus: 'EXITED',
      }),
    )

    expect(mutations).toEqual(['restart:dep-old'])
  })

  it('religar um serviço cujo deployment foi removido faz redeploy, não restart', async () => {
    const mutations = await run(
      INFRA_POWER_DIRECTION.ON,
      buildWebService({ isStopped: true, isRemoved: true, instanceStatus: undefined }),
    )

    expect(mutations).toEqual(['redeploy:svc-web'])
  })

  it('religar sem nenhum deployment faz redeploy do servico', async () => {
    const mutations = await run(INFRA_POWER_DIRECTION.ON, buildWebService({ hasDeployment: false }))

    expect(mutations).toEqual(['redeploy:svc-web'])
  })
})
