/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_ENVIRONMENT_CLASSIFICATION = {
  MANAGED: 'managed',
  PROTECTED: 'protected',
  UNMANAGED: 'unmanaged',
} as const
export type InfraEnvironmentClassification =
  (typeof INFRA_ENVIRONMENT_CLASSIFICATION)[keyof typeof INFRA_ENVIRONMENT_CLASSIFICATION]

export const INFRA_OPERATION_KIND = {
  POWER_OFF: 'power_off',
  POWER_ON: 'power_on',
} as const
export type InfraOperationKind = (typeof INFRA_OPERATION_KIND)[keyof typeof INFRA_OPERATION_KIND]

export const INFRA_OPERATION_STATUS = {
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  PARTIALLY_FAILED: 'partially_failed',
  FAILED: 'failed',
} as const
export type InfraOperationStatus = (typeof INFRA_OPERATION_STATUS)[keyof typeof INFRA_OPERATION_STATUS]

export const INFRA_OPERATION_TRIGGER = {
  MANUAL: 'manual',
  SCHEDULE: 'schedule',
} as const
export type InfraOperationTrigger = (typeof INFRA_OPERATION_TRIGGER)[keyof typeof INFRA_OPERATION_TRIGGER]

export const INFRA_SERVICE_POWER_STATE = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  NO_DEPLOYMENT: 'no_deployment',
  TRANSITIONING: 'transitioning',
} as const
export type InfraServicePowerState = (typeof INFRA_SERVICE_POWER_STATE)[keyof typeof INFRA_SERVICE_POWER_STATE]

/** Imagem de banco em `source.image`, por igualdade de nome; o nome do serviço só reforça quando a imagem vem nula. */
export const INFRA_DATABASE_IMAGE_NAMES = [
  'postgres',
  'postgres-ssl',
  'postgis',
  'redis',
  'redis-stack',
  'mysql',
  'mariadb',
  'mongo',
  'mongodb',
] as const
export const INFRA_DATABASE_NAME_PATTERN = /^(Postgres|Redis|MySQL|MongoDB)/

export const INFRA_POWER_DIRECTION = {
  OFF: 'off',
  ON: 'on',
} as const
export type InfraPowerDirection = (typeof INFRA_POWER_DIRECTION)[keyof typeof INFRA_POWER_DIRECTION]

export const INFRA_ENVIRONMENTS_CACHE_TTL_SECONDS = 30
export const INFRA_COSTS_CACHE_TTL_SECONDS = 900
export const INFRA_ACCESS_CACHE_TTL_SECONDS = 300
export const INFRA_ACCESS_TOKEN_INVALID_CACHE_TTL_SECONDS = 60
export const INFRA_COSTS_FALLBACK_CACHE_TTL_SECONDS = 60

export const RAILWAY_RATE_LIMIT_DEFAULT_WAIT_SECONDS = 30
export const RAILWAY_RATE_LIMIT_MAX_WAIT_SECONDS = 300

// Versionada: o cache guarda JSON sem validação, e mudar o formato do resultado num deploy futuro não pode ler a forma antiga.
export const INFRA_COSTS_CACHE_KEY = 'infra:costs:v1'
export const INFRA_COSTS_LAST_GOOD_CACHE_KEY = 'infra:costs:v1:last-good'
export const INFRA_COSTS_LAST_GOOD_TTL_SECONDS = 604_800
export const INFRA_COSTS_RETRY_DELAY_MILLISECONDS = 2000
export const INFRA_COSTS_DIVERGENCE_THRESHOLD_PERCENT = 5

export const INFRA_COSTS_WINDOW_SOURCE = {
  BILLING_CYCLE: 'billing_cycle',
  CALENDAR_MONTH: 'calendar_month',
} as const
export type InfraCostsWindowSource = (typeof INFRA_COSTS_WINDOW_SOURCE)[keyof typeof INFRA_COSTS_WINDOW_SOURCE]

export const INFRA_INVENTORY_CACHE_KEY = 'infra:inventory'
export const INFRA_ACCESS_CACHE_KEY = 'infra:access'
export const INFRA_INTEGRATION_VERIFY_CACHE_KEY = 'infra:integration:verify'
export const INFRA_INTEGRATION_VERIFY_CACHE_TTL_SECONDS = 30

export const INFRA_ENVIRONMENT_POWER_STATE = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  PARTIAL: 'partial',
  TRANSITIONING: 'transitioning',
} as const
export type InfraEnvironmentPowerState =
  (typeof INFRA_ENVIRONMENT_POWER_STATE)[keyof typeof INFRA_ENVIRONMENT_POWER_STATE]

export const INFRA_OPERATION_LOCK_KEY_PREFIX = 'infra:operation-lock:'
/** Folga da trava sobre a espera dos bancos: cobre o build de um serviço de repositório. */
export const INFRA_OPERATION_LOCK_GRACE_SECONDS = 600
export const INFRA_DATABASE_POLL_INTERVAL_SECONDS = 5

export const INFRA_SERVICE_OUTCOME = {
  OK: 'ok',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const
export type InfraServiceOutcome = (typeof INFRA_SERVICE_OUTCOME)[keyof typeof INFRA_SERVICE_OUTCOME]

export const INFRA_KEEP_ON_UNTIL_DEFAULT_HOURS = 2
export const INFRA_KEEP_ON_UNTIL_MAX_HOURS = 24

export const INFRA_SCHEDULE_TIMEZONE = 'America/Sao_Paulo'

export const INFRA_ACCESS_STATUS = {
  OK: 'ok',
  TOKEN_INVALID: 'token_invalid',
  BILLING_UNAVAILABLE: 'billing_unavailable',
  UNAVAILABLE: 'unavailable',
} as const
export type InfraAccessStatus = (typeof INFRA_ACCESS_STATUS)[keyof typeof INFRA_ACCESS_STATUS]

export const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.com/graphql/v2'

export const INFRA_SCHEDULE_ACTION = {
  POWER_ON: 'power_on',
  POWER_OFF: 'power_off',
  NONE: 'none',
} as const

export const INFRA_INTEGRATION_PROVIDER = {
  RAILWAY: 'railway',
} as const
export type InfraIntegrationProvider = (typeof INFRA_INTEGRATION_PROVIDER)[keyof typeof INFRA_INTEGRATION_PROVIDER]
