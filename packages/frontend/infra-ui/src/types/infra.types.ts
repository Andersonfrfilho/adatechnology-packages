/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  InfraAccessStatus,
  InfraEnvironmentClassification,
  InfraEnvironmentPowerState,
  InfraOperationKind,
  InfraOperationStatus,
  InfraOperationTrigger,
  InfraScheduledActionKind,
  InfraServiceOutcome,
  InfraServicePowerState,
} from '../constants/infra.constant'

export type InfraService = {
  readonly serviceName: string
  readonly isDatabase: boolean
  readonly powerState: InfraServicePowerState
}

export type InfraSchedule = {
  readonly id: string
  readonly activeWeekdays: readonly number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
  readonly timezone: string
  readonly isEnabled: boolean
  readonly keepOnUntil: string | null
  readonly lastEvaluatedAt: string | null
  readonly lastPowerOffAt: string | null
  readonly lastPowerOnAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type InfraNextScheduledAction = {
  readonly kind: InfraScheduledActionKind
  readonly at: string
}

export type InfraEnvironment = {
  readonly environmentId: string
  readonly environmentName: string
  readonly classification: InfraEnvironmentClassification
  readonly state: InfraEnvironmentPowerState
  readonly services: readonly InfraService[]
  /** O servidor decide: agenda ativa e agora fora da janela; o painel não deduz isso da próxima ação. */
  readonly requiresKeepOnUntil: boolean
  readonly schedule?: InfraSchedule
  readonly nextScheduledAction?: InfraNextScheduledAction
  readonly runningOperationId?: string
}

export type InfraProject = {
  readonly projectId: string
  readonly projectName: string
  readonly environments: readonly InfraEnvironment[]
}

export type ListInfraEnvironmentsResult = {
  readonly access: InfraAccessStatus
  readonly projects: readonly InfraProject[]
}

export type InfraServiceResult = {
  readonly serviceName: string
  readonly outcome: InfraServiceOutcome
  readonly errorCode?: string
}

export type InfraOperation = {
  readonly id: string
  readonly kind: InfraOperationKind
  readonly status: InfraOperationStatus
  readonly trigger: InfraOperationTrigger
  readonly serviceResults: readonly InfraServiceResult[]
  readonly startedAt: string
  readonly finishedAt: string | null
}

export type PowerEnvironmentResult = { readonly operationId: string }

export type PowerOffEnvironmentParams = { readonly environmentId: string }
export type PowerOnEnvironmentParams = {
  readonly environmentId: string
  /** ISO 8601 com offset. */
  readonly keepOnUntil?: string
}
export type GetInfraOperationParams = { readonly operationId: string }

export type InfraScheduleBody = {
  readonly activeWeekdays: readonly number[]
  readonly powerOnTime: string
  readonly powerOffTime: string
  readonly isEnabled: boolean
}
export type SaveEnvironmentScheduleParams = InfraScheduleBody & { readonly environmentId: string }
export type SaveEnvironmentScheduleResult = InfraSchedule & {
  readonly nextScheduledAction?: InfraNextScheduledAction
}

export type InfraEnvironmentCost = {
  readonly environmentId: string
  readonly environmentName: string
  readonly isProduction: boolean
  readonly cost: number
  readonly byMeasurement: Readonly<Record<string, number>>
}

export type InfraProjectCost = {
  readonly projectId: string
  readonly projectName: string
  readonly cost: number
  readonly projected: number
  readonly environments: readonly InfraEnvironmentCost[]
}

export type InfraCosts = {
  readonly periodStart: string
  readonly periodEnd: string
  readonly windowSource: string
  readonly currency: 'USD'
  readonly totalCost: number
  readonly officialTotal?: number
  readonly divergencePercent?: number
  readonly isDivergent: boolean
  readonly projectedTotal: number
  readonly projectionMethod: 'linear'
  readonly projects: readonly InfraProjectCost[]
  readonly pricingCheckedAt: string
  readonly pricingSource: string
  readonly isStale: boolean
}
