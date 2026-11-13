/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq } from 'drizzle-orm'

import type {
  InfraScheduleRecord,
  InfraScheduleRepositoryInterface,
  RecordScheduleEvaluationParams,
  SetKeepOnUntilParams,
  UpsertInfraScheduleParams,
} from '@adatechnology/infra-contracts'

import type { InfraDatabase } from '../database.types'
import { infraEnvironmentSchedules } from '../schema/schema'

export class DrizzleInfraScheduleRepository implements InfraScheduleRepositoryInterface {
  constructor(private readonly db: InfraDatabase) {}

  async findByEnvironmentId(environmentId: string): Promise<InfraScheduleRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(infraEnvironmentSchedules)
      .where(eq(infraEnvironmentSchedules.railwayEnvironmentId, environmentId))
      .limit(1)

    return row
  }

  async listAll(): Promise<readonly InfraScheduleRecord[]> {
    return this.db.select().from(infraEnvironmentSchedules)
  }

  async upsert(params: UpsertInfraScheduleParams): Promise<InfraScheduleRecord> {
    const values = {
      railwayProjectId: params.railwayProjectId,
      railwayEnvironmentId: params.railwayEnvironmentId,
      activeWeekdays: [...params.activeWeekdays],
      powerOnTime: params.powerOnTime,
      powerOffTime: params.powerOffTime,
      isEnabled: params.isEnabled,
      ...(params.updatedByAgentId ? { updatedByAgentId: params.updatedByAgentId } : {}),
    }

    const [row] = await this.db
      .insert(infraEnvironmentSchedules)
      .values(values)
      .onConflictDoUpdate({
        target: infraEnvironmentSchedules.railwayEnvironmentId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning()

    if (!row) throw new Error('Upsert da agenda de infra nao retornou linha')
    return row
  }

  async recordEvaluation(params: RecordScheduleEvaluationParams): Promise<void> {
    await this.db
      .update(infraEnvironmentSchedules)
      .set({
        lastEvaluatedAt: params.lastEvaluatedAt,
        ...(params.keepOnUntil !== undefined ? { keepOnUntil: params.keepOnUntil } : {}),
        ...(params.lastPowerOnAt ? { lastPowerOnAt: params.lastPowerOnAt } : {}),
        ...(params.lastPowerOffAt ? { lastPowerOffAt: params.lastPowerOffAt } : {}),
      })
      .where(eq(infraEnvironmentSchedules.railwayEnvironmentId, params.environmentId))
  }

  async setKeepOnUntil(params: SetKeepOnUntilParams): Promise<void> {
    await this.db
      .update(infraEnvironmentSchedules)
      .set({ keepOnUntil: params.keepOnUntil, updatedAt: new Date() })
      .where(eq(infraEnvironmentSchedules.railwayEnvironmentId, params.environmentId))
  }
}
