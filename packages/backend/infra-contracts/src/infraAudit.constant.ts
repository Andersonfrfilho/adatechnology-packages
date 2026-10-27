/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os valores são os mesmos da trilha de auditoria do host: o módulo emite a entrada e o host a
 * grava na própria tabela, pela porta `InfraAuditRecorderInterface`.
 */

export const INFRA_AUDIT_ACTOR_TYPE = {
  AGENT: 'agent',
  SYSTEM: 'system',
} as const
export type InfraAuditActorType = (typeof INFRA_AUDIT_ACTOR_TYPE)[keyof typeof INFRA_AUDIT_ACTOR_TYPE]

export const INFRA_AUDIT_ACTION = {
  INFRA_ENVIRONMENT_POWERED_OFF: 'infra.environment_powered_off',
  INFRA_ENVIRONMENT_POWERED_ON: 'infra.environment_powered_on',
  INFRA_SCHEDULE_CHANGED: 'infra.schedule_changed',
  INFRA_ENVIRONMENT_POWER_REQUESTED: 'infra.environment_power_requested',
  INFRA_ENVIRONMENT_POWER_DENIED: 'infra.environment_power_denied',
  INFRA_OPERATION_INTERRUPTED: 'infra.operation_interrupted',
  INFRA_INTEGRATION_CONFIGURED: 'infra.integration_configured',
  INFRA_INTEGRATION_REPLACED: 'infra.integration_replaced',
  INFRA_INTEGRATION_REMOVED: 'infra.integration_removed',
  INFRA_INTEGRATION_VERIFIED: 'infra.integration_verified',
  INFRA_INTEGRATION_DENIED: 'infra.integration_denied',
  INFRA_INTEGRATION_LOCKED: 'infra.integration_locked',
} as const
export type InfraAuditAction = (typeof INFRA_AUDIT_ACTION)[keyof typeof INFRA_AUDIT_ACTION]

export const INFRA_AUDIT_TARGET = {
  INFRA_ENVIRONMENT: 'infra_environment',
  INFRA_INTEGRATION: 'infra_integration',
} as const
export type InfraAuditTarget = (typeof INFRA_AUDIT_TARGET)[keyof typeof INFRA_AUDIT_TARGET]
