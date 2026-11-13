/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { and, eq, gt, lt } from 'drizzle-orm'

import { INFRA_OPERATION_STATUS } from '@adatechnology/infra-contracts'
import type {
  CreateInfraOperationParams,
  FindRunningOperationParams,
  FinishInfraOperationParams,
  InfraOperationRecord,
  InfraOperationRepositoryInterface,
  InfraOperationRow,
  ListRunningOperationsParams,
  MarkStaleRunningAsInterruptedParams,
} from '@adatechnology/infra-contracts'

import type { InfraDatabase } from '../database.types'
import { infraServiceResultsSchema } from '../infraOperation.schema'
import { infraPowerOperations } from '../schema/schema'

function toRecord(row: InfraOperationRow): InfraOperationRecord {
  return { ...row, serviceResults: infraServiceResultsSchema.parse(row.serviceResults) }
}

export class DrizzleInfraOperationRepository implements InfraOperationRepositoryInterface {
  constructor(private readonly db: InfraDatabase) {}

  async create(params: CreateInfraOperationParams): Promise<InfraOperationRecord> {
    const [row] = await this.db
      .insert(infraPowerOperations)
      .values({
        railwayProjectId: params.railwayProjectId,
        railwayEnvironmentId: params.railwayEnvironmentId,
        kind: params.kind,
        trigger: params.trigger,
        status: INFRA_OPERATION_STATUS.RUNNING,
        ...(params.actorAgentId ? { actorAgentId: params.actorAgentId } : {}),
      })
      .returning()

    if (!row) throw new Error('Insert da operacao de infra nao retornou linha')
    return toRecord(row)
  }

  async findById(id: string): Promise<InfraOperationRecord | undefined> {
    const [row] = await this.db.select().from(infraPowerOperations).where(eq(infraPowerOperations.id, id)).limit(1)

    return row ? toRecord(row) : undefined
  }

  async findRunningByEnvironmentId(params: FindRunningOperationParams): Promise<InfraOperationRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(infraPowerOperations)
      .where(
        and(
          eq(infraPowerOperations.railwayEnvironmentId, params.environmentId),
          eq(infraPowerOperations.status, INFRA_OPERATION_STATUS.RUNNING),
          gt(infraPowerOperations.startedAt, params.notOlderThan),
        ),
      )
      .limit(1)

    return row ? toRecord(row) : undefined
  }

  async listRunning(params: ListRunningOperationsParams): Promise<readonly InfraOperationRecord[]> {
    const rows = await this.db
      .select()
      .from(infraPowerOperations)
      .where(
        and(
          eq(infraPowerOperations.status, INFRA_OPERATION_STATUS.RUNNING),
          gt(infraPowerOperations.startedAt, params.notOlderThan),
        ),
      )

    return rows.map(toRecord)
  }

  async finishOperation(params: FinishInfraOperationParams): Promise<void> {
    await this.db
      .update(infraPowerOperations)
      .set({
        status: params.status,
        serviceResults: [...params.serviceResults],
        finishedAt: params.finishedAt,
      })
      .where(eq(infraPowerOperations.id, params.id))
  }

  async markStaleRunningAsInterrupted(
    params: MarkStaleRunningAsInterruptedParams,
  ): Promise<readonly InfraOperationRecord[]> {
    const rows = await this.db
      .update(infraPowerOperations)
      .set({ status: INFRA_OPERATION_STATUS.FAILED, finishedAt: new Date() })
      .where(
        and(
          eq(infraPowerOperations.status, INFRA_OPERATION_STATUS.RUNNING),
          lt(infraPowerOperations.startedAt, params.olderThan),
        ),
      )
      .returning()

    return rows.map(toRecord)
  }
}
