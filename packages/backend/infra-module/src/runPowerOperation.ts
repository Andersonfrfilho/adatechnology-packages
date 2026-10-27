/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_POWER_DIRECTION,
  INFRA_RESTART_POLICY_TYPE,
  INFRA_SERVICE_OUTCOME,
  INFRA_SERVICE_POWER_STATE,
} from '@adatechnology/infra-contracts'
import type { InfraRestartPolicyStoreInterface } from '@adatechnology/infra-contracts'
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
import { waitForFreshDeployments } from './waitForFreshDeployments'
import { INFRA_ERROR_CODES } from '@adatechnology/infra-contracts'

type Dependencies = {
  readonly gateway: InfraGatewayInterface
  readonly sleep: InfraSleep
  readonly databaseWaitSeconds: number
  /** Ausente = sem segunda tentativa: o serviço que não parar falha. */
  readonly restartPolicyStore?: InfraRestartPolicyStoreInterface
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
      notStopped.size > 0 ? await this.escalateStubborn({ names: notStopped, params, verify }) : notStopped

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
   * Parar não derrubou o serviço: o banco volta pela política de reinício. Segunda tentativa sem
   * apagar nada: guarda a política original, troca por "nunca", sobe um deployment novo já com ela,
   * espera ficar de pé e então para. O ligar devolve a política que estava antes.
   */
  private async escalateStubborn(options: {
    readonly names: ReadonlySet<string>
    readonly params: RunPowerOperationParams
    readonly verify: (serviceNames: readonly string[]) => Promise<ReadonlySet<string>>
  }): Promise<ReadonlySet<string>> {
    const { names, params, verify } = options
    const { gateway, restartPolicyStore } = this.dependencies
    if (!restartPolicyStore) return names

    const stubborn = params.services.filter((service) => names.has(service.serviceName))
    const prepared: InfraServiceInstance[] = []
    for (const service of stubborn) {
      const reference = { environmentId: params.environmentId, serviceId: service.serviceId }
      try {
        const current = await gateway.getRestartPolicy(reference)
        if (current.type !== INFRA_RESTART_POLICY_TYPE.NEVER) {
          await restartPolicyStore.save(reference, current)
          await gateway.setRestartPolicy({ ...reference, policy: { type: INFRA_RESTART_POLICY_TYPE.NEVER } })
        }
        await gateway.redeployService(reference)
        prepared.push(service)
      } catch {
        // Fica de fora: o serviço segue na lista dos que não pararam.
      }
    }
    if (prepared.length === 0) return names

    const notReady = await waitForFreshDeployments({
      ...this.dependencies,
      environmentId: params.environmentId,
      previousDeploymentIds: new Map(prepared.map((service) => [service.serviceName, service.latestDeploymentId])),
      onProgress: params.onProgress,
    })
    const readyNames = prepared.map((service) => service.serviceName).filter((name) => !notReady.has(name))
    await this.stopFreshDeployments({ environmentId: params.environmentId, names: readyNames })

    const stillRunning = await verify([...names])
    return new Set([...stillRunning, ...notReady])
  }

  /** O redeploy criou deployments novos: os ids de antes não servem mais, então relê o ambiente. */
  private async stopFreshDeployments(options: {
    readonly environmentId: string
    readonly names: readonly string[]
  }): Promise<void> {
    const { gateway } = this.dependencies
    const fresh = await gateway.getEnvironmentServices({ environmentId: options.environmentId }).catch(() => [])
    for (const service of fresh.filter((candidate) => options.names.includes(candidate.serviceName))) {
      const deploymentId = resolveTargetDeploymentId(service)
      const deploymentIds = service.activeDeploymentIds ?? (deploymentId ? [deploymentId] : [])
      for (const id of deploymentIds) await gateway.stopDeployment({ deploymentId: id }).catch(() => undefined)
    }
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

  /** Devolve a política que o desligamento trocou por "nunca". `true` = havia o que devolver. */
  private async restoreRestartPolicy(options: {
    readonly service: InfraServiceInstance
    readonly environmentId: string
  }): Promise<boolean> {
    const { restartPolicyStore, gateway } = this.dependencies
    if (!restartPolicyStore) return false
    const reference = { environmentId: options.environmentId, serviceId: options.service.serviceId }
    const saved = await restartPolicyStore.get(reference)
    if (!saved) return false

    await gateway.setRestartPolicy({ ...reference, policy: saved })
    await restartPolicyStore.delete(reference)
    return true
  }

  private async startService(params: StartServiceParams): Promise<InfraServiceResult> {
    const { service, environmentId } = params
    const { gateway } = this.dependencies
    const state = resolveServicePowerState(service)

    // Um servico que ja esta subindo nao leva segundo comando: a espera dos bancos cobre o resto.
    if (state === INFRA_SERVICE_POWER_STATE.RUNNING || state === INFRA_SERVICE_POWER_STATE.TRANSITIONING) {
      return buildResult(service, INFRA_SERVICE_OUTCOME.SKIPPED)
    }
    if (await this.restoreRestartPolicy({ service, environmentId })) {
      // A política volta no deployment novo: restart reaproveitaria o antigo, ainda com "nunca".
      await gateway.redeployService({ environmentId, serviceId: service.serviceId })
      return buildResult(service, INFRA_SERVICE_OUTCOME.OK)
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
