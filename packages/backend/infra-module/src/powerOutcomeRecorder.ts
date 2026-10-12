/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditRecorderInterface } from '@adatechnology/infra-contracts'
import {
  INFRA_INVENTORY_CACHE_KEY,
  INFRA_OPERATION_STATUS,
  type InfraPowerDirection,
} from '@adatechnology/infra-contracts'
import { buildPowerCompletedEntry } from './powerAuditEntries'
import { countServiceOutcomes } from './resolveOperationStatus'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import type { InfraCacheInterface } from '@adatechnology/infra-contracts'
import type { PowerOutcomeParams, RunOperationParams } from '@adatechnology/infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'
import type { InfraLogger } from '@adatechnology/infra-contracts'

export type PowerOutcomeRecorderDependencies = {
  readonly cache: InfraCacheInterface
  readonly operationRepository: InfraOperationRepositoryInterface
  readonly recordAudit: InfraAuditRecorderInterface
  readonly logger: InfraLogger
  readonly direction: InfraPowerDirection
}

type FailParams = {
  readonly params: RunOperationParams
  readonly error: unknown
}

/** Grava o desfecho da operacao (status, cache, auditoria) depois que o trabalho em segundo plano termina. */
export class PowerOutcomeRecorder {
  constructor(private readonly dependencies: PowerOutcomeRecorderDependencies) {}

  async invalidateInventory(): Promise<void> {
    try {
      await this.dependencies.cache.delete(INFRA_INVENTORY_CACHE_KEY)
    } catch {
      this.dependencies.logger.error('Nao foi possivel invalidar o cache do inventario de infra', {})
    }
  }

  async complete(outcome: PowerOutcomeParams): Promise<void> {
    await this.dependencies.operationRepository.finishOperation({
      id: outcome.params.operationId,
      status: outcome.status,
      serviceResults: outcome.serviceResults,
      finishedAt: new Date(),
    })
    await this.recordOutcome(outcome)
  }

  async fail(failure: FailParams): Promise<void> {
    const { logger, operationRepository } = this.dependencies
    const { params, error } = failure
    logger.error('Operacao de infra falhou de forma inesperada', {
      operationId: params.operationId,
      environmentId: params.environmentId,
      errorCode: resolveServiceErrorCode(error),
    })

    try {
      await operationRepository.finishOperation({
        id: params.operationId,
        status: INFRA_OPERATION_STATUS.FAILED,
        serviceResults: [],
        finishedAt: new Date(),
      })
    } catch {
      logger.error('Nao foi possivel marcar a operacao de infra como falha', { operationId: params.operationId })
    }
    await this.recordOutcome({ params, status: INFRA_OPERATION_STATUS.FAILED, serviceResults: [] })
  }

  /** Cache e auditoria depois do resultado gravado: se falharem, o log registra e o status nao muda. */
  private async recordOutcome(outcome: PowerOutcomeParams): Promise<void> {
    const { params, status, serviceResults } = outcome
    const { recordAudit, logger, direction } = this.dependencies
    const counts = countServiceOutcomes(serviceResults)

    await this.invalidateInventory()
    try {
      await recordAudit.execute(buildPowerCompletedEntry({ outcome, direction, counts }))
    } catch {
      logger.error('Nao foi possivel gravar a auditoria da operacao de infra', { operationId: params.operationId })
    }

    logger.info('Operacao de infra concluida', {
      operationId: params.operationId,
      environmentId: params.environmentId,
      direction,
      status,
      ...counts,
    })
  }
}
