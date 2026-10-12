/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAuditActorType, INFRA_AUDIT_ACTION, InfraAuditAction } from '../infraAudit.constant'
import type { INFRA_INTEGRATION_AUDIT_REASON, INFRA_INTEGRATION_AUDIT_SOURCE } from '../infraIntegrationAudit.constant'

export type InfraIntegrationAuditReason =
  (typeof INFRA_INTEGRATION_AUDIT_REASON)[keyof typeof INFRA_INTEGRATION_AUDIT_REASON]

export type InfraIntegrationAuditSource =
  (typeof INFRA_INTEGRATION_AUDIT_SOURCE)[keyof typeof INFRA_INTEGRATION_AUDIT_SOURCE]

export type InfraIntegrationAuditAction = Extract<
  InfraAuditAction,
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_CONFIGURED']
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_REPLACED']
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_REMOVED']
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_VERIFIED']
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_DENIED']
  | (typeof INFRA_AUDIT_ACTION)['INFRA_INTEGRATION_LOCKED']
>

/** Tipo fechado: so estes tres campos. Nenhum texto livre (message, error, token, ciphertext). */
export type InfraIntegrationAuditMetadata = {
  readonly reason: InfraIntegrationAuditReason
  readonly source?: InfraIntegrationAuditSource
  readonly workspaceId?: string
}

export type BuildInfraIntegrationAuditEntryParams = {
  readonly action: InfraIntegrationAuditAction
  readonly actor: { readonly type: InfraAuditActorType; readonly agentId?: string }
  readonly ipAddress?: string
  readonly targetId?: string
  readonly metadata: InfraIntegrationAuditMetadata
}
