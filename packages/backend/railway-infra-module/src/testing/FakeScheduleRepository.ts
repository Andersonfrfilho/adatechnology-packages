/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { FAKE_NOW } from './fakeNow.constant'
import type {
  InfraScheduleRecord,
  RecordScheduleEvaluationParams,
  SetKeepOnUntilParams,
  UpsertInfraScheduleParams,
} from '@adatechnology/railway-infra-contracts'
import type { InfraScheduleRepositoryInterface } from '@adatechnology/railway-infra-contracts'

export class FakeScheduleRepository implements InfraScheduleRepositoryInterface {
  readonly records = new Map<string, InfraScheduleRecord>()
  readonly upsertCalls: UpsertInfraScheduleParams[] = []
  readonly keepOnUntilCalls: SetKeepOnUntilParams[] = []
  readonly evaluationCalls: RecordScheduleEvaluationParams[] = []

  seed(record: InfraScheduleRecord): void {
    this.records.set(record.railwayEnvironmentId, record)
  }

  async findByEnvironmentId(environmentId: string): Promise<InfraScheduleRecord | undefined> {
    return this.records.get(environmentId)
  }

  async listAll(): Promise<readonly InfraScheduleRecord[]> {
    return [...this.records.values()]
  }

  async upsert(params: UpsertInfraScheduleParams): Promise<InfraScheduleRecord> {
    this.upsertCalls.push(params)
    const existing = this.records.get(params.railwayEnvironmentId)
    const record: InfraScheduleRecord = {
      id: existing?.id ?? `schedule-${this.records.size + 1}`,
      railwayProjectId: params.railwayProjectId,
      railwayEnvironmentId: params.railwayEnvironmentId,
      activeWeekdays: [...params.activeWeekdays],
      powerOnTime: params.powerOnTime,
      powerOffTime: params.powerOffTime,
      timezone: existing?.timezone ?? 'America/Sao_Paulo',
      isEnabled: params.isEnabled,
      keepOnUntil: existing?.keepOnUntil ?? null,
      lastEvaluatedAt: existing?.lastEvaluatedAt ?? null,
      lastPowerOffAt: existing?.lastPowerOffAt ?? null,
      lastPowerOnAt: existing?.lastPowerOnAt ?? null,
      updatedByAgentId: params.updatedByAgentId ?? existing?.updatedByAgentId ?? null,
      createdAt: existing?.createdAt ?? FAKE_NOW,
      updatedAt: FAKE_NOW,
    }
    this.records.set(params.railwayEnvironmentId, record)
    return record
  }

  async recordEvaluation(params: RecordScheduleEvaluationParams): Promise<void> {
    this.evaluationCalls.push(params)
    const current = this.records.get(params.environmentId)
    if (!current) return
    this.records.set(params.environmentId, {
      ...current,
      lastEvaluatedAt: params.lastEvaluatedAt,
      ...(params.keepOnUntil !== undefined ? { keepOnUntil: params.keepOnUntil } : {}),
      ...(params.lastPowerOnAt ? { lastPowerOnAt: params.lastPowerOnAt } : {}),
      ...(params.lastPowerOffAt ? { lastPowerOffAt: params.lastPowerOffAt } : {}),
    })
  }

  async setKeepOnUntil(params: SetKeepOnUntilParams): Promise<void> {
    this.keepOnUntilCalls.push(params)
    const current = this.records.get(params.environmentId)
    if (!current) return
    this.records.set(params.environmentId, { ...current, keepOnUntil: params.keepOnUntil })
  }
}
