/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_ACCESS_STATUS,
  INFRA_ENVIRONMENTS_CACHE_TTL_SECONDS,
  INFRA_INVENTORY_CACHE_KEY,
  type InfraAccessStatus,
} from '@adatechnology/infra-contracts'
import { parseAccessStatus, resolveAccessCacheTtlSeconds } from './infraAccessCache'
import { InfraNotConfiguredError } from '@adatechnology/infra-contracts'
import { infraInventoryCacheSchema } from './infraInventory.schema'
import { parseCachedJson } from './parseCachedJson'
import { classifyEnvironment } from './classifyEnvironment'
import { isDatabaseService } from './isDatabaseService'
import { resolveEnvironmentPowerState } from './resolveEnvironmentPowerState'
import { resolveRunningOperationCutoff } from './resolveRunningOperationCutoff'
import { resolveNextScheduledActionView } from './resolveNextScheduledActionView'
import { isInsideScheduleWindow } from './resolveScheduleAction'
import { resolveServicePowerState } from './resolveServicePowerState'
import type { InfraCacheInterface } from '@adatechnology/infra-contracts'
import type {
  InfraEnvironmentView,
  InfraProjectView,
  ListInfraEnvironmentsResult,
} from '@adatechnology/infra-contracts'
import type { InfraOperationRecord } from '@adatechnology/infra-contracts'
import type { InfraScheduleRecord } from '@adatechnology/infra-contracts'
import type { InfraEnvironment, InfraProject } from '@adatechnology/infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { ResolveGateway } from '@adatechnology/infra-contracts'

type Dependencies = {
  readonly resolveGateway: ResolveGateway
  /** Ausente = sempre atual. Falso quando o token trocou durante a chamada: o resultado não vai para o cache. */
  readonly isGatewayCurrent?: (gateway: InfraGatewayInterface) => boolean
  readonly cache: InfraCacheInterface
  readonly operationRepository: InfraOperationRepositoryInterface
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly managedPattern: string
  readonly selfEnvironmentId: string
  readonly databaseWaitSeconds: number
  readonly now?: () => Date
}

function byName<TItem>(getName: (item: TItem) => string): (left: TItem, right: TItem) => number {
  return (left, right) => getName(left).localeCompare(getName(right))
}

/**
 * Estado de energia vem do Railway (cache curto); agenda e operacao em andamento vem do banco e nunca
 * entram no cache, porque mudam por acao do usuario e a tela precisa refletir na hora.
 */
export class ListInfraEnvironmentsUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(): Promise<ListInfraEnvironmentsResult> {
    // Antes de qualquer leitura de cache: remover o token precisa devolver 503 na hora.
    const gateway = await this.dependencies.resolveGateway()
    if (!gateway) throw new InfraNotConfiguredError()

    const access = await this.resolveAccess(gateway)
    if (access === INFRA_ACCESS_STATUS.TOKEN_INVALID || access === INFRA_ACCESS_STATUS.UNAVAILABLE) {
      return { access, projects: [] }
    }

    const inventory = await this.resolveInventory(gateway)
    const schedulesByEnvironmentId = await this.indexSchedules()
    const runningByEnvironmentId = await this.indexRunningOperations()

    const projects = [...inventory]
      .sort(byName((project) => project.name))
      .map((project) => this.buildProjectView({ project, schedulesByEnvironmentId, runningByEnvironmentId }))

    return { access, projects }
  }

  private async resolveAccess(gateway: InfraGatewayInterface): Promise<InfraAccessStatus> {
    const { cache } = this.dependencies
    const cached = parseAccessStatus(await cache.get(INFRA_ACCESS_CACHE_KEY))
    if (cached) return cached

    const access = await gateway.verifyAccess()
    const ttlSeconds = resolveAccessCacheTtlSeconds(access)
    if (ttlSeconds !== undefined && this.isCurrent(gateway)) await cache.set(INFRA_ACCESS_CACHE_KEY, access, ttlSeconds)
    return access
  }

  private async resolveInventory(gateway: InfraGatewayInterface): Promise<readonly InfraProject[]> {
    const { cache } = this.dependencies
    const cached = await cache.get(INFRA_INVENTORY_CACHE_KEY)
    if (cached !== null) {
      const parsed = parseCachedJson({ raw: cached, schema: infraInventoryCacheSchema })
      if (parsed) return parsed as readonly InfraProject[]
    }

    const inventory = await gateway.listInventory()
    if (this.isCurrent(gateway)) {
      await cache.set(INFRA_INVENTORY_CACHE_KEY, JSON.stringify(inventory), INFRA_ENVIRONMENTS_CACHE_TTL_SECONDS)
    }
    return inventory
  }

  private isCurrent(gateway: InfraGatewayInterface): boolean {
    return this.dependencies.isGatewayCurrent?.(gateway) ?? true
  }

  private async indexSchedules(): Promise<ReadonlyMap<string, InfraScheduleRecord>> {
    const schedules = await this.dependencies.scheduleRepository.listAll()
    return new Map(schedules.map((schedule) => [schedule.railwayEnvironmentId, schedule]))
  }

  // Uma consulta por listagem: o N+1 anterior fazia uma ida ao banco por ambiente.
  private async indexRunningOperations(): Promise<ReadonlyMap<string, InfraOperationRecord>> {
    const { operationRepository, databaseWaitSeconds } = this.dependencies
    const now = (this.dependencies.now ?? (() => new Date()))()
    const running = await operationRepository.listRunning({
      notOlderThan: resolveRunningOperationCutoff({ now, databaseWaitSeconds }),
    })
    return new Map(running.map((operation) => [operation.railwayEnvironmentId, operation]))
  }

  private buildProjectView(params: {
    readonly project: InfraProject
    readonly schedulesByEnvironmentId: ReadonlyMap<string, InfraScheduleRecord>
    readonly runningByEnvironmentId: ReadonlyMap<string, InfraOperationRecord>
  }): InfraProjectView {
    const { project, schedulesByEnvironmentId, runningByEnvironmentId } = params
    const environments = [...project.environments].sort(byName((environment) => environment.name)).map((environment) =>
      this.buildEnvironmentView({
        environment,
        schedule: schedulesByEnvironmentId.get(environment.id),
        runningOperation: runningByEnvironmentId.get(environment.id),
      }),
    )

    return { projectId: project.id, projectName: project.name, environments }
  }

  private buildEnvironmentView(params: {
    readonly environment: InfraEnvironment
    readonly schedule: InfraScheduleRecord | undefined
    readonly runningOperation: InfraOperationRecord | undefined
  }): InfraEnvironmentView {
    const { environment, schedule, runningOperation } = params
    const { managedPattern, selfEnvironmentId } = this.dependencies
    const now = (this.dependencies.now ?? (() => new Date()))()
    const nextScheduledAction = schedule ? resolveNextScheduledActionView({ schedule, now }) : undefined
    // Mesma regra que o desligar/ligar usa para exigir o keepOnUntil; o painel não pode deduzir isso.
    const requiresKeepOnUntil = schedule?.isEnabled === true && !isInsideScheduleWindow({ schedule, at: now })

    const services = environment.services.map((service) => ({
      serviceName: service.serviceName,
      isDatabase: isDatabaseService(service),
      powerState: resolveServicePowerState(service),
    }))

    return {
      environmentId: environment.id,
      environmentName: environment.name,
      classification: classifyEnvironment({
        environmentName: environment.name,
        environmentId: environment.id,
        managedPattern,
        selfEnvironmentId,
      }),
      state: resolveEnvironmentPowerState(services.map((service) => service.powerState)),
      services,
      requiresKeepOnUntil,
      ...(schedule ? { schedule } : {}),
      ...(nextScheduledAction ? { nextScheduledAction } : {}),
      ...(runningOperation ? { runningOperationId: runningOperation.id } : {}),
    }
  }
}
