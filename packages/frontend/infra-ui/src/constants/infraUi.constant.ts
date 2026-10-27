/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_TIME_ZONE = 'America/Sao_Paulo'

export const MILLISECONDS_PER_MINUTE = 60_000
export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR
export const KEEP_ON_MAX_HOURS = 24

export const KEEP_ON_OPTION_ID = {
  PLUS_ONE_HOUR: 'plusOneHour',
  PLUS_TWO_HOURS: 'plusTwoHours',
  PLUS_FOUR_HOURS: 'plusFourHours',
  END_OF_DAY: 'endOfDay',
} as const
export type KeepOnOptionId = (typeof KEEP_ON_OPTION_ID)[keyof typeof KEEP_ON_OPTION_ID]
export const DEFAULT_KEEP_ON_OPTION_ID: KeepOnOptionId = KEEP_ON_OPTION_ID.PLUS_TWO_HOURS

export const SCHEDULE_VALIDATION_ERROR = {
  NO_WEEKDAYS: 'no_weekdays',
  INVALID_TIME: 'invalid_time',
  CROSSES_MIDNIGHT: 'crosses_midnight',
  EMPTY_WINDOW: 'empty_window',
} as const
export type ScheduleValidationError = (typeof SCHEDULE_VALIDATION_ERROR)[keyof typeof SCHEDULE_VALIDATION_ERROR]

export const BUSINESS_HOURS_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5]
export const BUSINESS_HOURS_POWER_ON_TIME = '08:00'
export const BUSINESS_HOURS_POWER_OFF_TIME = '20:00'
export const WEEKDAY_INDEXES: readonly number[] = [0, 1, 2, 3, 4, 5, 6]

export const COST_MEASUREMENT = {
  CPU: 'CPU_USAGE',
  MEMORY: 'MEMORY_USAGE_GB',
  NETWORK: 'NETWORK_TX_GB',
  DISK: 'DISK_USAGE_GB',
} as const
export type CostMeasurement = (typeof COST_MEASUREMENT)[keyof typeof COST_MEASUREMENT]
export const COST_MEASUREMENT_COLUMNS: readonly CostMeasurement[] = [
  COST_MEASUREMENT.CPU,
  COST_MEASUREMENT.MEMORY,
  COST_MEASUREMENT.NETWORK,
  COST_MEASUREMENT.DISK,
]

export const CALENDAR_MONTH_WINDOW_SOURCE = 'calendar_month'

export const COST_KIND = { STAGING: 'staging', PRODUCTION: 'production' } as const
export type CostKind = (typeof COST_KIND)[keyof typeof COST_KIND]
/** Id do padrao SVG da homologacao; so ha um grafico por tela, entao o id fixo nao colide. */
export const COST_STAGING_PATTERN_ID = 'infra-cost-staging-pattern'
