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
} from '@adatechnology/infra-contracts'
import type { InfraOperationRepositoryInterface } from '@adatechnology/infra-contracts'

export class FakeOperationRepository implements InfraOperationRepositoryInterface {
  readonly operations: InfraOperationRecord[] = []
  readonly staleCalls: MarkStaleRunningAsInterruptedParams[] = []
  listRunningCalls = 0
  /** Instante de início atribuído às próximas operações criadas. */
  nextStartedAt: Date = new Date('2026-10-09T12:00:00Z')
  /** Quantas chamadas de `finishOperation` ainda devem lancar. */
  finishFailures = 0

  async create(params: CreateInfraOperationParams): Promise<InfraOperationRecord> {
    const record: InfraOperationRecord = {
      id: `operation-${this.operations.length + 1}`,
      railwayProjectId: params.railwayProjectId,
      railwayEnvironmentId: params.railwayEnvironmentId,
      kind: params.kind,
      status: 'running',
      trigger: params.trigger,
      actorAgentId: params.actorAgentId ?? null,
      serviceResults: [],
      startedAt: this.nextStartedAt,
      finishedAt: null,
    }
    this.operations.push(record)
    return record
  }

  async findById(id: string): Promise<InfraOperationRecord | undefined> {
    return this.operations.find((operation) => operation.id === id)
  }

  async findRunningByEnvironmentId(params: FindRunningOperationParams): Promise<InfraOperationRecord | undefined> {
    return this.operations.find(
      (operation) =>
        operation.railwayEnvironmentId === params.environmentId &&
        operation.status === 'running' &&
        operation.startedAt > params.notOlderThan,
    )
  }

  async listRunning(params: ListRunningOperationsParams): Promise<readonly InfraOperationRecord[]> {
    this.listRunningCalls += 1
    return this.operations.filter(
      (operation) => operation.status === 'running' && operation.startedAt > params.notOlderThan,
    )
  }

  async finishOperation(params: FinishInfraOperationParams): Promise<void> {
    if (this.finishFailures > 0) {
      this.finishFailures -= 1
      throw new Error('database down')
    }
    const index = this.operations.findIndex((operation) => operation.id === params.id)
    const current = this.operations[index]
    if (!current) return
    this.operations[index] = {
      ...current,
      status: params.status,
      serviceResults: params.serviceResults,
      finishedAt: params.finishedAt,
    }
  }

  async markStaleRunningAsInterrupted(
    params: MarkStaleRunningAsInterruptedParams,
  ): Promise<readonly InfraOperationRecord[]> {
    this.staleCalls.push(params)
    const marked: InfraOperationRecord[] = []
    this.operations.forEach((operation, index) => {
      if (operation.status !== 'running' || operation.startedAt >= params.olderThan) return
      const interrupted = { ...operation, status: 'failed', finishedAt: new Date() }
      this.operations[index] = interrupted
      marked.push(interrupted)
    })
    return marked
  }
}
