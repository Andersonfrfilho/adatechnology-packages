/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

/** Relativos ao `basePath` que o host escolhe ao montar as rotas. */
export const INFRA_ROUTE_PATH = {
  ENVIRONMENTS: '/infra/environments',
  ENVIRONMENT: '/infra/environments/:environmentId',
  OPERATION: '/infra/operations/:operationId',
  COSTS: '/infra/costs',
  INTEGRATION: '/infra/integration',
  INTEGRATION_VERIFY: '/infra/integration/verify',
} as const

/** O host traduz cada perfil para a regra de limite dele; o módulo só diz de qual rota se trata. */
export const INFRA_RATE_LIMIT_PROFILE = {
  READ: 'read',
  WRITE: 'write',
  POWER: 'power',
  POWER_PER_AGENT: 'power_per_agent',
  INTEGRATION_WRITE: 'integration_write',
  INTEGRATION_VERIFY: 'integration_verify',
} as const
export type InfraRateLimitProfile = (typeof INFRA_RATE_LIMIT_PROFILE)[keyof typeof INFRA_RATE_LIMIT_PROFILE]

export const INFRA_AGENT_BUCKET = {
  POWER_OFF: 'POST:infra-power-off:agent',
  POWER_ON: 'POST:infra-power-on:agent',
  INTEGRATION_SAVE: 'PUT:infra-integration:agent',
  INTEGRATION_REMOVE: 'DELETE:infra-integration:agent',
  INTEGRATION_VERIFY: 'POST:infra-integration-verify:agent',
} as const

/** Escopo que o host concede ao administrador que pode operar a infraestrutura. */
export const INFRA_ADMIN_SCOPE = 'infra:admin'

export const INFRA_RATE_LIMITED_CODE = 'RATE_LIMITED'
