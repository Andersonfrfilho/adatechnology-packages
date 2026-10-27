/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export {
  INFRA_ACCESS_STATUS,
  INFRA_ENVIRONMENT_CLASSIFICATION,
  INFRA_ENVIRONMENT_POWER_STATE,
  INFRA_OPERATION_KIND,
  INFRA_OPERATION_STATUS,
  INFRA_OPERATION_TRIGGER,
  INFRA_SERVICE_OUTCOME,
  INFRA_SERVICE_POWER_STATE,
} from '@adatechnology/infra-contracts'
export type {
  InfraAccessStatus,
  InfraEnvironmentClassification,
  InfraEnvironmentPowerState,
  InfraOperationKind,
  InfraOperationStatus,
  InfraOperationTrigger,
  InfraServiceOutcome,
  InfraServicePowerState,
} from '@adatechnology/infra-contracts'

export const INFRA_SCHEDULED_ACTION_KIND = { POWER_ON: 'power_on', POWER_OFF: 'power_off' } as const
export type InfraScheduledActionKind = (typeof INFRA_SCHEDULED_ACTION_KIND)[keyof typeof INFRA_SCHEDULED_ACTION_KIND]

/** Inclui `RATE_LIMITED`, código genérico do host que não pertence ao contrato do módulo. */
export const INFRA_ERROR_CODE = {
  NOT_CONFIGURED: 'INFRA_NOT_CONFIGURED',
  ENVIRONMENT_PROTECTED: 'INFRA_ENVIRONMENT_PROTECTED',
  OPERATION_IN_PROGRESS: 'INFRA_OPERATION_IN_PROGRESS',
  KEEP_ON_UNTIL_REQUIRED: 'INFRA_KEEP_ON_UNTIL_REQUIRED',
  INVALID_SCHEDULE: 'INFRA_INVALID_SCHEDULE',
  INFRA_PROVIDER_REQUEST_FAILED: 'INFRA_PROVIDER_REQUEST_FAILED',
  INFRA_PROVIDER_RATE_LIMITED: 'INFRA_PROVIDER_RATE_LIMITED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export const INFRA_QUERY_KEY = {
  ENVIRONMENTS: 'infra-environments',
  COSTS: 'infra-costs',
  INTEGRATION: 'infra-integration',
  OPERATION: 'infra-operation',
} as const

export const INFRA_POLL_INTERVAL_MS = 15_000
export const INFRA_COSTS_STALE_TIME_MS = 5 * 60_000
