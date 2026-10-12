/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_POWER_DIRECTION,
  INFRA_SERVICE_OUTCOME,
  INFRA_SERVICE_POWER_STATE,
} from '@adatechnology/railway-infra-contracts'
import { isDatabaseService } from './isDatabaseService'
import { orderServicesForPower } from './orderServicesForPower'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraServiceResult, RunPowerOperationParams } from '@adatechnology/railway-infra-contracts'
import type { InfraSleep } from '@adatechnology/railway-infra-contracts'
import type { RailwayServiceInstance } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import { waitForDatabases } from './waitForDatabases'
import { RAILWAY_INFRA_ERROR_CODES } from '@adatechnology/railway-infra-contracts'

type Dependencies = {
  readonly railwayGateway: RailwayGatewayInterface
  readonly sleep: InfraSleep
  readonly databaseWaitSeconds: number
}

type ServiceHandler = (service: RailwayServiceInstance) => Promise<InfraServiceResult>

type PowerContext = {
  readonly databases: readonly RailwayServiceInstance[]
  readonly applications: readonly RailwayServiceInstance[]
  readonly params: RunPowerOperationParams
}

type RunGroupParams = {
  readonly services: readonly RailwayServiceInstance[]
  readonly handler: ServiceHandler
  readonly onProgress: () => Promise<void>
}

type StartServiceParams = {
  readonly service: RailwayServiceInstance
  readonly environmentId: string
}

// O ativo e o que roda; o ultimo pode estar em build ou ter falhado, e parar/religar nele erra o alvo.
function resolveTargetDeploymentId(service: RailwayServiceInstance): string | undefined {
  return service.activeDeploymentId ?? service.latestDeploymentId
}

function buildResult(service: RailwayServiceInstance, outcome: InfraServiceResult['outcome']): InfraServiceResult {
  return { serviceName: service.serviceName, outcome }
}

/**
 * Percorre os servicos de um ambiente na ordem segura e devolve o resultado de cada um.
 *
 * Falha em um servico vira resultado `failed` e nunca interrompe os demais do grupo. "Pronto" e
 * `resolveServicePowerState === RUNNING`: o status SUCCESS sozinho tambem descreve um deployment parado.
 * `onProgress` nao pode lancar (o chamador o torna seguro): ele renova a trava depois de cada servico.
 */
export class RunPowerOperation {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(params: RunPowerOperationParams): Promise<readonly InfraServiceResult[]> {
    const { ordered } = orderServicesForPower({ services: params.services, direction: params.direction })
    const context: PowerContext = {
      databases: ordered.filter(isDatabaseService),
      applications: ordered.filter((service) => !isDatabaseService(service)),
      params,
    }

    if (params.direction === INFRA_POWER_DIRECTION.OFF) return this.powerOff(context)
    return this.powerOn(context)
  }

  private async powerOff(context: PowerContext): Promise<readonly InfraServiceResult[]> {
    const { databases, applications, params } = context
    const handler: ServiceHandler = (service) => this.stopService(service)
    const applicationResults = await this.runGroup({ services: applications, handler, onProgress: params.onProgress })
    const databaseResults = await this.runGroup({ services: databases, handler, onProgress: params.onProgress })
    return [...applicationResults, ...databaseResults]
  }

  private async powerOn(context: PowerContext): Promise<readonly InfraServiceResult[]> {
    const { databases, applications, params } = context
    const handler: ServiceHandler = (service) => this.startService({ service, environmentId: params.environmentId })
    const startedDatabases = await this.runGroup({ services: databases, handler, onProgress: params.onProgress })

    const notReadyNames = await waitForDatabases({
      ...this.dependencies,
      environmentId: params.environmentId,
      serviceNames: startedDatabases
        .filter((result) => result.outcome !== INFRA_SERVICE_OUTCOME.FAILED)
        .map((result) => result.serviceName),
      onProgress: params.onProgress,
    })
    const databaseResults: InfraServiceResult[] = startedDatabases.map((result) =>
      notReadyNames.has(result.serviceName)
        ? {
            serviceName: result.serviceName,
            outcome: INFRA_SERVICE_OUTCOME.FAILED,
            errorCode: RAILWAY_INFRA_ERROR_CODES.INFRA_DATABASE_NOT_READY,
          }
        : result,
    )

    // Aplicacao sem banco sobe quebrada e pode gravar estado inconsistente: fica parada.
    const isDatabaseLayerHealthy = databaseResults.every((result) => result.outcome !== INFRA_SERVICE_OUTCOME.FAILED)
    const applicationResults = isDatabaseLayerHealthy
      ? await this.runGroup({ services: applications, handler, onProgress: params.onProgress })
      : applications.map((service) => buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED))

    return [...databaseResults, ...applicationResults]
  }

  private async runGroup(params: RunGroupParams): Promise<InfraServiceResult[]> {
    const { services, handler, onProgress } = params
    const settled = await Promise.allSettled(
      services.map(async (service) => {
        try {
          return await handler(service)
        } finally {
          await onProgress()
        }
      }),
    )

    return settled.map((outcome, index) => {
      if (outcome.status === 'fulfilled') return outcome.value
      return {
        serviceName: services[index]?.serviceName ?? '',
        outcome: INFRA_SERVICE_OUTCOME.FAILED,
        errorCode: resolveServiceErrorCode(outcome.reason),
      }
    })
  }

  private async stopService(service: RailwayServiceInstance): Promise<InfraServiceResult> {
    const state = resolveServicePowerState(service)
    const isAlreadyOff =
      state === INFRA_SERVICE_POWER_STATE.STOPPED || state === INFRA_SERVICE_POWER_STATE.NO_DEPLOYMENT
    const deploymentId = resolveTargetDeploymentId(service)
    if (isAlreadyOff || deploymentId === undefined) {
      return buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED)
    }

    await this.dependencies.railwayGateway.stopDeployment({ deploymentId })
    return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
  }

  private async startService(params: StartServiceParams): Promise<InfraServiceResult> {
    const { service, environmentId } = params
    const { railwayGateway } = this.dependencies
    const state = resolveServicePowerState(service)

    // Um servico que ja esta subindo nao leva segundo comando: a espera dos bancos cobre o resto.
    if (state === INFRA_SERVICE_POWER_STATE.RUNNING || state === INFRA_SERVICE_POWER_STATE.TRANSITIONING) {
      return buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED)
    }
    const deploymentId = resolveTargetDeploymentId(service)
    if (state === INFRA_SERVICE_POWER_STATE.STOPPED && deploymentId !== undefined) {
      await railwayGateway.restartDeployment({ deploymentId })
      return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
    }

    await railwayGateway.redeployService({ environmentId, serviceId: service.serviceId })
    return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
  }
}
