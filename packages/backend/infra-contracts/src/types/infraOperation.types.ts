/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditActorType } from '../infraAudit.constant'
import type {
  InfraOperationStatus,
  InfraOperationTrigger,
  InfraPowerDirection,
  InfraServiceOutcome,
} from '../infra.constant'
import type { InfraGatewayInterface } from './infraGateway.interface'
import type { InfraServiceInstance } from './infraInventory.types'

export type InfraServiceResultOutcome = InfraServiceOutcome

export type InfraServiceResult = {
  readonly serviceName: string
  readonly outcome: InfraServiceResultOutcome
  readonly errorCode?: string | undefined
}

export type InfraOperationRow = {
  readonly id: string
  readonly railwayProjectId: string
  readonly railwayEnvironmentId: string
  readonly kind: string
  readonly status: string
  readonly trigger: string
  readonly actorAgentId: string | null
  readonly serviceResults: unknown
  readonly startedAt: Date
  readonly finishedAt: Date | null
}

export type InfraOperationRecord = Omit<InfraOperationRow, 'serviceResults'> & {
  readonly serviceResults: readonly InfraServiceResult[]
}

export type CreateInfraOperationParams = {
  readonly railwayProjectId: string
  readonly railwayEnvironmentId: string
  readonly kind: string
  readonly trigger: string
  readonly actorAgentId?: string
}

export type FinishInfraOperationParams = {
  readonly id: string
  readonly status: string
  readonly serviceResults: readonly InfraServiceResult[]
  readonly finishedAt: Date
}

export type MarkStaleRunningAsInterruptedParams = { readonly olderThan: Date }

export type FindRunningOperationParams = { readonly environmentId: string; readonly notOlderThan: Date }

export type ListRunningOperationsParams = { readonly notOlderThan: Date }

export type GetInfraOperationParams = { readonly operationId: string }

export type GetInfraOperationResult = Pick<
  InfraOperationRecord,
  'id' | 'kind' | 'status' | 'trigger' | 'serviceResults' | 'startedAt' | 'finishedAt' | 'railwayEnvironmentId'
>

export type PowerEnvironmentParams = {
  readonly environmentId: string
  readonly actor: { readonly type: InfraAuditActorType; readonly agentId?: string }
  readonly trigger: InfraOperationTrigger
  readonly ipAddress?: string
  readonly keepOnUntil?: Date
  /** Só estes serviços; ausente = o ambiente inteiro. */
  readonly serviceIds?: readonly string[]
}

export type PowerEnvironmentResult = { readonly operationId: string }

/** Tudo que o runner em segundo plano precisa, já resolvido pelo `execute`. */
export type RunOperationParams = {
  /** O gateway que admitiu a operacao: trocar o token depois do 202 nao muda o que ela usa. */
  readonly gateway: InfraGatewayInterface
  readonly operationId: string
  readonly projectId: string
  readonly projectName: string
  readonly environmentId: string
  readonly environmentName: string
  readonly services: readonly InfraServiceInstance[]
  /** Todos os serviços do ambiente: `services` pode ser só a seleção, e ligar aplicação depende dos bancos que não entraram. */
  readonly environmentServices?: readonly InfraServiceInstance[]
  readonly actor: PowerEnvironmentParams['actor']
  readonly trigger: InfraOperationTrigger
  /** Valor gravado na trava de Redis por esta operacao: so quem o tem renova ou libera a trava. */
  readonly lockOwner: string
  readonly ipAddress?: string
}

export type RunPowerOperationParams = {
  readonly direction: InfraPowerDirection
  readonly environmentId: string
  readonly services: readonly InfraServiceInstance[]
  readonly environmentServices?: readonly InfraServiceInstance[]
  /** Chamado a cada serviço processado e a cada consulta de espera, para renovar a trava. */
  readonly onProgress: () => Promise<void>
}

export type ResolveOperationStatusParams = { readonly serviceResults: readonly InfraServiceResult[] }

export type PowerOutcomeParams = {
  readonly params: RunOperationParams
  readonly status: InfraOperationStatus
  readonly serviceResults: readonly InfraServiceResult[]
}
