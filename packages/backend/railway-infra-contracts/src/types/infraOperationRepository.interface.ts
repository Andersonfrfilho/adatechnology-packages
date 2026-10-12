/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  CreateInfraOperationParams,
  FindRunningOperationParams,
  FinishInfraOperationParams,
  InfraOperationRecord,
  ListRunningOperationsParams,
  MarkStaleRunningAsInterruptedParams,
} from './infraOperation.types'

export interface InfraOperationRepositoryInterface {
  create(params: CreateInfraOperationParams): Promise<InfraOperationRecord>
  findById(id: string): Promise<InfraOperationRecord | undefined>
  /** Ignora operações com `startedAt` anterior a `notOlderThan`: passado o TTL da trava, a operação está morta. */
  findRunningByEnvironmentId(params: FindRunningOperationParams): Promise<InfraOperationRecord | undefined>
  /** Uma consulta para todos os ambientes; mesma regra de `notOlderThan`. */
  listRunning(params: ListRunningOperationsParams): Promise<readonly InfraOperationRecord[]>
  finishOperation(params: FinishInfraOperationParams): Promise<void>
  /** Devolve as operações marcadas como interrompidas. */
  markStaleRunningAsInterrupted(params: MarkStaleRunningAsInterruptedParams): Promise<readonly InfraOperationRecord[]>
}
