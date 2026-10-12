/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_DATABASE_POLL_INTERVAL_SECONDS, INFRA_SERVICE_POWER_STATE } from '@adatechnology/railway-infra-contracts'
import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraSleep } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'

const MILLISECONDS_PER_SECOND = 1000

export type WaitForDatabasesParams = {
  readonly railwayGateway: RailwayGatewayInterface
  readonly sleep: InfraSleep
  readonly databaseWaitSeconds: number
  readonly environmentId: string
  readonly serviceNames: readonly string[]
  readonly onProgress: () => Promise<void>
}

type FindNotRunningParams = {
  readonly railwayGateway: RailwayGatewayInterface
  readonly environmentId: string
  readonly serviceNames: ReadonlySet<string>
}

/** Devolve os bancos que nao ficaram RUNNING no prazo; a espera e uma consulta de estado a cada 5 s. */
export async function waitForDatabases(params: WaitForDatabasesParams): Promise<ReadonlySet<string>> {
  const { railwayGateway, sleep, databaseWaitSeconds, environmentId, serviceNames, onProgress } = params
  const maxPolls = Math.floor(databaseWaitSeconds / INFRA_DATABASE_POLL_INTERVAL_SECONDS)
  let pendingNames: ReadonlySet<string> = new Set(serviceNames)

  // Sequencial por natureza: cada consulta depende de a anterior ter dito que ainda nao esta pronto.
  for (let poll = 0; pendingNames.size > 0 && poll <= maxPolls; poll += 1) {
    pendingNames = await findNotRunning({ railwayGateway, environmentId, serviceNames: pendingNames })
    if (pendingNames.size === 0 || poll === maxPolls) break
    await sleep(INFRA_DATABASE_POLL_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND)
    await onProgress()
  }

  return pendingNames
}

async function findNotRunning(params: FindNotRunningParams): Promise<ReadonlySet<string>> {
  // Leitura que falha uma vez nao reprova o banco: conta como "ainda nao pronto" e tenta na proxima rodada.
  const services = await params.railwayGateway
    .getEnvironmentServices({ environmentId: params.environmentId })
    .catch(() => undefined)
  if (services === undefined) return params.serviceNames

  const runningNames = new Set(
    services
      .filter((service) => resolveServicePowerState(service) === INFRA_SERVICE_POWER_STATE.RUNNING)
      .map((service) => service.serviceName),
  )
  return new Set([...params.serviceNames].filter((serviceName) => !runningNames.has(serviceName)))
}
