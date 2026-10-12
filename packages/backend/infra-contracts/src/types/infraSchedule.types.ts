/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { INFRA_SCHEDULE_ACTION } from '../infra.constant'
import type { PowerEnvironmentParams } from './infraOperation.types'

export type InfraScheduleRecord = {
  readonly id: string
  readonly railwayProjectId: string
  readonly railwayEnvironmentId: string
  readonly activeWeekdays: number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
  readonly timezone: string
  readonly isEnabled: boolean
  readonly keepOnUntil: Date | null
  readonly lastEvaluatedAt: Date | null
  readonly lastPowerOffAt: Date | null
  readonly lastPowerOnAt: Date | null
  readonly updatedByAgentId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type UpsertInfraScheduleParams = {
  readonly railwayProjectId: string
  readonly railwayEnvironmentId: string
  readonly activeWeekdays: readonly number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
  readonly isEnabled: boolean
  readonly updatedByAgentId?: string
}

export type RecordScheduleEvaluationParams = {
  readonly environmentId: string
  readonly lastEvaluatedAt: Date
  readonly keepOnUntil?: Date | null
  readonly lastPowerOnAt?: Date
  readonly lastPowerOffAt?: Date
}

export type SetKeepOnUntilParams = { readonly environmentId: string; readonly keepOnUntil: Date | null }

export type InfraNextScheduledActionView = {
  readonly kind: InfraScheduledTransition['kind']
  readonly at: string
}

export type InfraScheduleAction = (typeof INFRA_SCHEDULE_ACTION)[keyof typeof INFRA_SCHEDULE_ACTION]

export type InfraScheduledTransition = {
  readonly kind: typeof INFRA_SCHEDULE_ACTION.POWER_ON | typeof INFRA_SCHEDULE_ACTION.POWER_OFF
  readonly at: Date
}

export type InfraScheduleWindowInput = Pick<
  InfraScheduleRecord,
  'activeWeekdays' | 'powerOnTime' | 'powerOffTime' | 'timezone' | 'isEnabled' | 'keepOnUntil' | 'lastEvaluatedAt'
>

export type ResolveScheduleActionParams = {
  readonly schedule: InfraScheduleWindowInput
  readonly now: Date
}

export type ResolveScheduleActionResult = {
  readonly action: InfraScheduleAction
  readonly shouldClearKeepOn: boolean
  readonly nextScheduledAction: InfraScheduledTransition | undefined
}

export type IsInsideScheduleWindowParams = {
  readonly schedule: Pick<InfraScheduleWindowInput, 'activeWeekdays' | 'powerOnTime' | 'powerOffTime' | 'timezone'>
  readonly at: Date
}

export type ResolveNextScheduledActionViewParams = {
  readonly schedule: InfraScheduleWindowInput
  readonly now: Date
}

export type ValidateScheduleWindowParams = {
  readonly activeWeekdays: readonly number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
}

export type SaveEnvironmentScheduleParams = ValidateScheduleWindowParams & {
  readonly environmentId: string
  readonly isEnabled: boolean
  readonly actor: PowerEnvironmentParams['actor']
  readonly ipAddress?: string
}

export type SaveEnvironmentScheduleResult = {
  readonly schedule: InfraScheduleRecord
  readonly nextScheduledAction: InfraNextScheduledActionView | undefined
}
