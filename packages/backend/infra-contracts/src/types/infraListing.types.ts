/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type {
  InfraAccessStatus,
  InfraEnvironmentClassification,
  InfraEnvironmentPowerState,
  InfraServicePowerState,
} from '../infra.constant'
import type { InfraScheduleRecord, InfraNextScheduledActionView } from './infraSchedule.types'

export type InfraServiceView = {
  readonly serviceName: string
  readonly isDatabase: boolean
  readonly powerState: InfraServicePowerState
}

export type InfraEnvironmentView = {
  readonly environmentId: string
  readonly environmentName: string
  readonly classification: InfraEnvironmentClassification
  readonly state: InfraEnvironmentPowerState
  readonly services: readonly InfraServiceView[]
  readonly requiresKeepOnUntil: boolean
  readonly schedule?: InfraScheduleRecord
  readonly nextScheduledAction?: InfraNextScheduledActionView
  readonly runningOperationId?: string
}

export type InfraProjectView = {
  readonly projectId: string
  readonly projectName: string
  readonly environments: readonly InfraEnvironmentView[]
}

export type ListInfraEnvironmentsResult = {
  readonly access: InfraAccessStatus
  readonly projects: readonly InfraProjectView[]
}
