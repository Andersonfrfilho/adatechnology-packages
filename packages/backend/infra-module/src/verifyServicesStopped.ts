/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_DATABASE_POLL_INTERVAL_SECONDS, INFRA_SERVICE_POWER_STATE } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface, InfraSleep } from '@adatechnology/infra-contracts'

import { resolveServicePowerState } from './resolveServicePowerState'

const MILLISECONDS_PER_SECOND = 1000
const MAX_CHECKS = 4

export type VerifyServicesStoppedParams = {
  readonly gateway: InfraGatewayInterface
  readonly sleep: InfraSleep
  readonly environmentId: string
  readonly serviceNames: readonly string[]
  readonly onProgress: () => Promise<void>
}

/**
 * O provedor aceita o comando de parar e pode continuar com o serviço no ar (mais de um deployment
 * ativo, por exemplo). Devolve os que seguem RUNNING depois de algumas consultas de estado; leitura
 * que falha não reprova ninguém, porque o comando foi aceito e o estado só não pôde ser confirmado.
 */
export async function verifyServicesStopped(params: VerifyServicesStoppedParams): Promise<ReadonlySet<string>> {
  const { gateway, sleep, environmentId, serviceNames, onProgress } = params
  let pendingNames: ReadonlySet<string> = new Set(serviceNames)

  // Sequencial por natureza: cada consulta decide se vale esperar e perguntar de novo.
  for (let check = 0; pendingNames.size > 0 && check < MAX_CHECKS; check += 1) {
    if (check > 0) {
      await sleep(INFRA_DATABASE_POLL_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
      await onProgress()
    }
    const services = await gateway.getEnvironmentServices({ environmentId }).catch(() => undefined)
    if (services === undefined) return new Set()

    const runningNames = new Set(
      services
        .filter((service) => resolveServicePowerState(service) === INFRA_SERVICE_POWER_STATE.RUNNING)
        .map((service) => service.serviceName),
    )
    pendingNames = new Set([...pendingNames].filter((serviceName) => runningNames.has(serviceName)))
  }

  return pendingNames
}
