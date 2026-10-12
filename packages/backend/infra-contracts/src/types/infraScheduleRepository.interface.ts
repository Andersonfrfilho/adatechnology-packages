/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  InfraScheduleRecord,
  RecordScheduleEvaluationParams,
  SetKeepOnUntilParams,
  UpsertInfraScheduleParams,
} from './infraSchedule.types'

export interface InfraScheduleRepositoryInterface {
  findByEnvironmentId(environmentId: string): Promise<InfraScheduleRecord | undefined>
  listAll(): Promise<readonly InfraScheduleRecord[]>
  /** Grava so a janela e `isEnabled`; `keepOnUntil` e o estado de avaliacao da agenda existente ficam intactos. */
  upsert(params: UpsertInfraScheduleParams): Promise<InfraScheduleRecord>
  /** Atualiza so os campos informados; `keepOnUntil: null` limpa. */
  recordEvaluation(params: RecordScheduleEvaluationParams): Promise<void>
  setKeepOnUntil(params: SetKeepOnUntilParams): Promise<void>
}
