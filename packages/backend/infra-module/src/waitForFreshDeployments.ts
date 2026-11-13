/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_DATABASE_POLL_INTERVAL_SECONDS, INFRA_SERVICE_POWER_STATE } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface, InfraSleep } from '@adatechnology/infra-contracts'

import { resolveServicePowerState } from './resolveServicePowerState'

const MILLISECONDS_PER_SECOND = 1000

export type WaitForFreshDeploymentsParams = {
  readonly gateway: InfraGatewayInterface
  readonly sleep: InfraSleep
  readonly databaseWaitSeconds: number
  readonly environmentId: string
  /** Nome do serviço → id do último deployment ANTES do redeploy. */
  readonly previousDeploymentIds: ReadonlyMap<string, string | undefined>
  readonly onProgress: () => Promise<void>
}

/**
 * Espera o redeploy valer: o serviço só conta como pronto quando o último deployment é OUTRO e está
 * RUNNING. Olhar só "RUNNING" é enganoso, porque o deployment de antes segue rodando até o novo assumir.
 * Devolve os que não ficaram prontos no prazo.
 */
export async function waitForFreshDeployments(params: WaitForFreshDeploymentsParams): Promise<ReadonlySet<string>> {
  const { gateway, sleep, databaseWaitSeconds, environmentId, previousDeploymentIds, onProgress } = params
  const maxPolls = Math.floor(databaseWaitSeconds / INFRA_DATABASE_POLL_INTERVAL_SECONDS)
  let pendingNames: ReadonlySet<string> = new Set(previousDeploymentIds.keys())

  // Sequencial por natureza: cada consulta decide se vale esperar e perguntar de novo.
  for (let poll = 0; pendingNames.size > 0 && poll <= maxPolls; poll += 1) {
    const services = await gateway.getEnvironmentServices({ environmentId }).catch(() => undefined)
    if (services !== undefined) {
      const readyNames = new Set(
        services
          .filter(
            (service) =>
              resolveServicePowerState(service) === INFRA_SERVICE_POWER_STATE.RUNNING &&
              service.latestDeploymentId !== previousDeploymentIds.get(service.serviceName),
          )
          .map((service) => service.serviceName),
      )
      pendingNames = new Set([...pendingNames].filter((serviceName) => !readyNames.has(serviceName)))
    }
    if (pendingNames.size === 0 || poll === maxPolls) break
    await sleep(INFRA_DATABASE_POLL_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
    await onProgress()
  }

  return pendingNames
}
