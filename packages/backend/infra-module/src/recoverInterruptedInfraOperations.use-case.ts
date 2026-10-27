/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/infra-contracts'
import type { InfraAuditRecorderInterface } from '@adatechnology/infra-contracts'
import { isUuid } from './isUuid'
import { recordInfraAudit } from './recordInfraAudit'
import { resolveRunningOperationCutoff } from './resolveRunningOperationCutoff'
import { resolveServiceErrorCode } from './resolveServiceErrorCode'
import type { InfraOperationRecord } from '@adatechnology/infra-contracts'
import type { InfraLogger } from '@adatechnology/infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'

type Dependencies = {
  readonly operationRepository: InfraOperationRepositoryInterface
  readonly recordAudit: InfraAuditRecorderInterface
  readonly logger: InfraLogger
  readonly databaseWaitSeconds: number
  readonly now: () => Date
}

/**
 * No boot e a cada tick do agendador, operacao `running` mais velha que o TTL da trava e de um processo
 * que morreu no meio (deploy, crash): sem isto o painel mostraria "em andamento" para sempre.
 */
export class RecoverInterruptedInfraOperationsUseCase {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(): Promise<number> {
    const { operationRepository, databaseWaitSeconds, now } = this.dependencies

    const interrupted = await operationRepository.markStaleRunningAsInterrupted({
      olderThan: resolveRunningOperationCutoff({ now: now(), databaseWaitSeconds }),
    })
    const audits = await Promise.allSettled(interrupted.map((operation) => this.auditInterruption(operation)))
    this.logRejectedAudits({ audits, interrupted })

    return interrupted.length
  }

  private logRejectedAudits(params: {
    readonly audits: readonly PromiseSettledResult<void>[]
    readonly interrupted: readonly InfraOperationRecord[]
  }): void {
    params.audits.forEach((audit, index) => {
      if (audit.status === 'fulfilled') return
      this.dependencies.logger.error('Nao foi possivel auditar a operacao de infra interrompida', {
        operationId: params.interrupted[index]?.id,
        errorCode: resolveServiceErrorCode(audit.reason),
      })
    })
  }

  private async auditInterruption(operation: InfraOperationRecord): Promise<void> {
    const { recordAudit, logger } = this.dependencies
    await recordInfraAudit({
      recordAudit,
      logger,
      entry: {
        actorType: INFRA_AUDIT_ACTOR_TYPE.SYSTEM,
        action: INFRA_AUDIT_ACTION.INFRA_OPERATION_INTERRUPTED,
        targetType: INFRA_AUDIT_TARGET.INFRA_ENVIRONMENT,
        ...(isUuid(operation.railwayEnvironmentId) ? { targetId: operation.railwayEnvironmentId } : {}),
        metadata: {
          operationId: operation.id,
          kind: operation.kind,
          startedAt: operation.startedAt.toISOString(),
          railwayEnvironmentId: operation.railwayEnvironmentId,
        },
      },
    })
  }
}
