/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { assertServicesExist } from './assertServicesExist'
import type { InfraAuditRecorderInterface } from '@adatechnology/infra-contracts'
import type { InfraPowerDirection } from '@adatechnology/infra-contracts'
import { InfraNotConfiguredError, InfraOperationInProgressError } from '@adatechnology/infra-contracts'
import { buildRunOperationParams } from './buildRunOperationParams'
import { InfraOperationLock } from './InfraOperationLock'
import { locateManagedEnvironment } from './locateManagedEnvironment'
import { buildPowerDeniedEntry, buildPowerRequestedEntry, resolveDenialReason } from './powerAuditEntries'
import { PowerOutcomeRecorder } from './powerOutcomeRecorder'
import { recordInfraAudit } from './recordInfraAudit'
import { registerPowerOperation } from './registerPowerOperation'
import { resolveKeepOnUntil } from './resolveKeepOnUntil'
import { resolveOperationStatus } from './resolveOperationStatus'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import { RunPowerOperation } from './runPowerOperation'
import type { InfraCacheInterface } from '@adatechnology/infra-contracts'
import type {
  InfraOperationRecord,
  PowerEnvironmentParams,
  PowerEnvironmentResult,
  RunOperationParams,
} from '@adatechnology/infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraLogger, InfraSleep } from '@adatechnology/infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { ResolveGateway } from '@adatechnology/infra-contracts'
import type { Admission, AdmitParams, DispatchParams, RegisterParams } from '@adatechnology/infra-contracts'

export type PowerEnvironmentDependencies = {
  readonly resolveGateway: ResolveGateway
  readonly cache: InfraCacheInterface
  readonly operationRepository: InfraOperationRepositoryInterface
  readonly scheduleRepository: InfraScheduleRepositoryInterface
  readonly recordAudit: InfraAuditRecorderInterface
  readonly logger: InfraLogger
  readonly sleep: InfraSleep
  readonly managedPattern: string
  readonly selfEnvironmentId: string
  readonly databaseWaitSeconds: number
  readonly now: () => Date
}

type Dependencies = PowerEnvironmentDependencies & { readonly direction: InfraPowerDirection }

/**
 * Liga ou desliga um ambiente. O `execute` valida, trava e cria a operacao; o trabalho de verdade roda
 * em segundo plano em `runOperation`, para a rota responder 202 antes de o Railway terminar.
 *
 * Ambiente `unmanaged` e recusado com o mesmo erro do protegido: o que nao e gerenciavel pelo painel
 * nao ganha botao de ligar/desligar, e a resposta 403 e a mesma.
 */
export class PowerEnvironmentUseCase {
  private readonly lock: InfraOperationLock
  private readonly outcomeRecorder: PowerOutcomeRecorder

  constructor(private readonly dependencies: Dependencies) {
    this.lock = new InfraOperationLock(dependencies)
    this.outcomeRecorder = new PowerOutcomeRecorder(dependencies)
  }

  async execute(params: PowerEnvironmentParams): Promise<PowerEnvironmentResult> {
    const gateway = await this.requireGateway()
    const admission = await this.admitOrAuditDenial({ params, gateway })
    const operation = await this.registerOperation({ params, ...admission })
    await this.outcomeRecorder.invalidateInventory()
    await this.dispatch({ params, admission, operation, gateway: gateway })

    return { operationId: operation.id }
  }

  /** Nunca rejeita: qualquer falha marca a operacao como `failed`, e a trava e sempre liberada. */
  async runOperation(params: RunOperationParams): Promise<void> {
    try {
      const serviceResults = await this.buildRunner(params.gateway).execute({
        direction: this.dependencies.direction,
        environmentId: params.environmentId,
        services: params.services,
        environmentServices: params.environmentServices ?? params.services,
        onProgress: () => this.lock.renew(params),
      })
      await this.outcomeRecorder.complete({
        params,
        status: resolveOperationStatus({ serviceResults }),
        serviceResults,
      })
    } catch (error) {
      await this.outcomeRecorder.fail({ params, error })
    } finally {
      await this.lock.release(params)
    }
  }

  private async dispatch(options: DispatchParams): Promise<void> {
    const { params, admission, operation, gateway } = options
    const { project, environment, lockOwner } = admission
    const { direction, logger, recordAudit } = this.dependencies
    await recordInfraAudit({
      recordAudit,
      logger,
      entry: buildPowerRequestedEntry({
        params,
        direction,
        operationId: operation.id,
        projectName: project.name,
        environmentName: environment.name,
      }),
    })

    const runParams = buildRunOperationParams({
      operationId: operation.id,
      params,
      project,
      environment,
      lockOwner,
      gateway,
    })
    void this.runOperation(runParams).catch((error: unknown) => {
      logger.error('Falha inesperada no runner de infra', {
        operationId: operation.id,
        direction,
        errorCode: resolveServiceErrorCode(error),
      })
    })
  }

  // Fallback de auditoria: a recusa e registrada e o MESMO erro segue para o chamador.
  private async admitOrAuditDenial(params: AdmitParams): Promise<Admission> {
    try {
      return await this.admit(params)
    } catch (error) {
      const reason = resolveDenialReason(error)
      if (reason) {
        await recordInfraAudit({
          recordAudit: this.dependencies.recordAudit,
          logger: this.dependencies.logger,
          entry: buildPowerDeniedEntry({ params: params.params, direction: this.dependencies.direction, reason }),
        })
      }
      throw error
    }
  }

  private async admit(params: AdmitParams): Promise<Admission> {
    const { managedPattern, selfEnvironmentId, direction, scheduleRepository, now } = this.dependencies
    const { project, environment } = await locateManagedEnvironment({
      gateway: params.gateway,
      environmentId: params.params.environmentId,
      managedPattern,
      selfEnvironmentId,
    })
    assertServicesExist({ environment, serviceIds: params.params.serviceIds })
    // Antes da trava e de qualquer operacao: um keepOnUntil recusado nao pode deixar rastro.
    const keepOnUntilChange = await resolveKeepOnUntil({
      params: params.params,
      environmentId: environment.id,
      direction,
      scheduleRepository,
      now,
    })

    const lockOwner = await this.lock.acquire(environment.id)
    if (!lockOwner) throw new InfraOperationInProgressError()

    return { project, environment, keepOnUntilChange, lockOwner }
  }

  private async requireGateway(): Promise<InfraGatewayInterface> {
    const gateway = await this.dependencies.resolveGateway()
    if (!gateway) throw new InfraNotConfiguredError()
    return gateway
  }

  private buildRunner(gateway: InfraGatewayInterface): RunPowerOperation {
    const { sleep, databaseWaitSeconds } = this.dependencies
    return new RunPowerOperation({ gateway, sleep, databaseWaitSeconds })
  }

  private registerOperation(options: RegisterParams): Promise<InfraOperationRecord> {
    const { direction, scheduleRepository, operationRepository } = this.dependencies
    return registerPowerOperation({ ...options, direction, lock: this.lock, scheduleRepository, operationRepository })
  }
}
