/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_POWER_DIRECTION, INFRA_SERVICE_OUTCOME, INFRA_SERVICE_POWER_STATE } from '@adatechnology/infra-contracts'
import { isDatabaseService } from './isDatabaseService'
import { orderServicesForPower } from './orderServicesForPower'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraServiceResult, RunPowerOperationParams } from '@adatechnology/infra-contracts'
import type { InfraSleep } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import { verifyServicesStopped } from './verifyServicesStopped'
import { waitForDatabases } from './waitForDatabases'
import { INFRA_ERROR_CODES } from '@adatechnology/infra-contracts'

type Dependencies = {
  readonly gateway: InfraGatewayInterface
  readonly sleep: InfraSleep
  readonly databaseWaitSeconds: number
}

type ServiceHandler = (service: InfraServiceInstance) => Promise<InfraServiceResult>

type PowerContext = {
  readonly databases: readonly InfraServiceInstance[]
  readonly applications: readonly InfraServiceInstance[]
  /** Bancos do ambiente que não entraram na seleção e não estão rodando: ligar aplicação sem eles sobe quebrado. */
  readonly stoppedUnselectedDatabases: readonly InfraServiceInstance[]
  readonly params: RunPowerOperationParams
}

type RunGroupParams = {
  readonly services: readonly InfraServiceInstance[]
  readonly handler: ServiceHandler
  readonly onProgress: () => Promise<void>
}

type StartServiceParams = {
  readonly service: InfraServiceInstance
  readonly environmentId: string
}

// O ativo e o que roda; o ultimo pode estar em build ou ter falhado, e parar/religar nele erra o alvo.
function resolveTargetDeploymentId(service: InfraServiceInstance): string | undefined {
  return service.activeDeploymentId ?? service.latestDeploymentId
}

function buildResult(service: InfraServiceInstance, outcome: InfraServiceResult['outcome']): InfraServiceResult {
  return { serviceName: service.serviceName, outcome }
}

function findStoppedUnselectedDatabases(params: RunPowerOperationParams): readonly InfraServiceInstance[] {
  const selectedIds = new Set(params.services.map((service) => service.serviceId))
  return (params.environmentServices ?? params.services).filter(
    (service) =>
      isDatabaseService(service) &&
      !selectedIds.has(service.serviceId) &&
      resolveServicePowerState(service) !== INFRA_SERVICE_POWER_STATE.RUNNING,
  )
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
      stoppedUnselectedDatabases: findStoppedUnselectedDatabases(params),
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
    return this.confirmStopped({ results: [...applicationResults, ...databaseResults], params })
  }

  /** O comando aceito não prova serviço parado: o que seguir RUNNING depois da espera vira falha visível. */
  private async confirmStopped(options: {
    readonly results: readonly InfraServiceResult[]
    readonly params: RunPowerOperationParams
  }): Promise<readonly InfraServiceResult[]> {
    const { results, params } = options
    const stoppedNames = results
      .filter((result) => result.outcome === INFRA_SERVICE_OUTCOME.OK)
      .map((r) => r.serviceName)
    if (stoppedNames.length === 0) return results

    const verify = (serviceNames: readonly string[]) =>
      verifyServicesStopped({
        gateway: this.dependencies.gateway,
        sleep: this.dependencies.sleep,
        environmentId: params.environmentId,
        serviceNames,
        onProgress: params.onProgress,
      })
    const notStopped = await verify(stoppedNames)
    const stillRunning =
      notStopped.size > 0 ? await this.removeAndVerify({ names: notStopped, params, verify }) : notStopped

    return results.map((result) =>
      stillRunning.has(result.serviceName)
        ? {
            serviceName: result.serviceName,
            outcome: INFRA_SERVICE_OUTCOME.FAILED,
            errorCode: INFRA_ERROR_CODES.INFRA_SERVICE_STILL_RUNNING,
          }
        : result,
    )
  }

  /**
   * Parar não derrubou o serviço (o banco volta pela política de reinício, por exemplo): segunda
   * tentativa removendo o deployment. Os dados ficam no volume e subir de novo é um redeploy.
   */
  private async removeAndVerify(options: {
    readonly names: ReadonlySet<string>
    readonly params: RunPowerOperationParams
    readonly verify: (serviceNames: readonly string[]) => Promise<ReadonlySet<string>>
  }): Promise<ReadonlySet<string>> {
    const { names, params, verify } = options
    const stubborn = params.services.filter((service) => names.has(service.serviceName))
    for (const service of stubborn) {
      const deploymentIds = service.activeDeploymentIds ?? [resolveTargetDeploymentId(service)]
      for (const id of deploymentIds) {
        if (id !== undefined)
          await this.dependencies.gateway.removeDeployment({ deploymentId: id }).catch(() => undefined)
      }
    }

    return verify([...names])
  }

  private async powerOn(context: PowerContext): Promise<readonly InfraServiceResult[]> {
    const { databases, applications, stoppedUnselectedDatabases, params } = context
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
            errorCode: INFRA_ERROR_CODES.INFRA_DATABASE_NOT_READY,
          }
        : result,
    )

    // Aplicacao sem banco sobe quebrada e pode gravar estado inconsistente: fica parada.
    const isDatabaseLayerHealthy =
      stoppedUnselectedDatabases.length === 0 &&
      databaseResults.every((result) => result.outcome !== INFRA_SERVICE_OUTCOME.FAILED)
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

  private async stopService(service: InfraServiceInstance): Promise<InfraServiceResult> {
    const state = resolveServicePowerState(service)
    const isAlreadyOff =
      state === INFRA_SERVICE_POWER_STATE.STOPPED || state === INFRA_SERVICE_POWER_STATE.NO_DEPLOYMENT
    const deploymentId = resolveTargetDeploymentId(service)
    if (isAlreadyOff || deploymentId === undefined) {
      return buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED)
    }

    // Todo deployment ativo: parar só o primeiro deixa o serviço rodando quando há dois.
    const deploymentIds = service.activeDeploymentIds ?? [deploymentId]
    for (const id of deploymentIds) {
      await this.dependencies.gateway.stopDeployment({ deploymentId: id })
    }
    return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
  }

  private async startService(params: StartServiceParams): Promise<InfraServiceResult> {
    const { service, environmentId } = params
    const { gateway } = this.dependencies
    const state = resolveServicePowerState(service)

    // Um servico que ja esta subindo nao leva segundo comando: a espera dos bancos cobre o resto.
    if (state === INFRA_SERVICE_POWER_STATE.RUNNING || state === INFRA_SERVICE_POWER_STATE.TRANSITIONING) {
      return buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED)
    }
    const deploymentId = resolveTargetDeploymentId(service)
    if (state === INFRA_SERVICE_POWER_STATE.STOPPED && deploymentId !== undefined && !service.isRemoved) {
      await gateway.restartDeployment({ deploymentId })
      return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
    }

    await gateway.redeployService({ environmentId, serviceId: service.serviceId })
    return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
  }
}
