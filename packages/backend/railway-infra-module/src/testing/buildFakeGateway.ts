/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayProject, RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'

export type FakeGateway = RailwayGatewayInterface & {
  readonly events: string[]
  inventoryReads: number
  environmentReads: number
}

export type FakeGatewayOptions = {
  readonly projects: readonly RailwayProject[]
  /** Estado devolvido na n-esima leitura do ambiente (1-based). */
  readonly environmentServices?: (readNumber: number) => readonly RailwayServiceInstance[]
  /** Devolve um erro para fazer a mutation `stop:dep-x`/`restart:dep-x`/`redeploy:env/svc` lancar. */
  readonly failMutation?: (mutation: string) => Error | undefined
  /** Segura as mutations ate a promise resolver. */
  readonly gate?: Promise<void>
}

const UNUSED_GATEWAY_METHODS = {
  async getBillingCycle() {
    throw new Error('not used')
  },
  async getUsage() {
    return []
  },
  async getEstimatedUsage() {
    return []
  },
  async verifyAccess() {
    return 'ok' as const
  },
}

/** Fake em memoria do gateway: registra TODA mutation em `events`. */
export function buildFakeGateway(options: FakeGatewayOptions): FakeGateway {
  const events: string[] = []
  const fake = { events, inventoryReads: 0, environmentReads: 0 }

  async function mutate(mutation: string): Promise<void> {
    events.push(mutation)
    if (options.gate) await options.gate
    const failure = options.failMutation?.(mutation)
    if (failure) throw failure
  }

  return Object.assign(fake, {
    async listInventory() {
      fake.inventoryReads += 1
      return options.projects
    },
    async getEnvironmentServices() {
      fake.environmentReads += 1
      events.push('read')
      const provider = options.environmentServices
      return provider ? provider(fake.environmentReads) : []
    },
    stopDeployment: ({ deploymentId }: { deploymentId: string }) => mutate(`stop:${deploymentId}`),
    restartDeployment: ({ deploymentId }: { deploymentId: string }) => mutate(`restart:${deploymentId}`),
    redeployService: ({ environmentId, serviceId }: { environmentId: string; serviceId: string }) =>
      mutate(`redeploy:${environmentId}/${serviceId}`),
    ...UNUSED_GATEWAY_METHODS,
  })
}
