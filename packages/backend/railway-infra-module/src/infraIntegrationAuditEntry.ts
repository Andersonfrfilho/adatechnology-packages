/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION, INFRA_AUDIT_TARGET } from '@adatechnology/railway-infra-contracts'
import type { InfraAuditEntry } from '@adatechnology/railway-infra-contracts'
import { INFRA_INTEGRATION_AUDIT_REASON, INFRA_INTEGRATION_AUDIT_SOURCE } from '@adatechnology/railway-infra-contracts'
import type {
  BuildInfraIntegrationAuditEntryParams,
  InfraIntegrationAuditMetadata,
} from '@adatechnology/railway-infra-contracts'

// Checagem em runtime: o TypeScript nao impede um objeto largo vindo de fora de chegar aqui.
const ALLOWED_ACTIONS: ReadonlySet<string> = new Set<string>([
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_CONFIGURED,
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_REPLACED,
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_REMOVED,
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_VERIFIED,
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_DENIED,
  INFRA_AUDIT_ACTION.INFRA_INTEGRATION_LOCKED,
])
const ALLOWED_METADATA_KEYS: ReadonlySet<string> = new Set<string>(['reason', 'source', 'workspaceId'])
const ALLOWED_REASONS: ReadonlySet<string> = new Set<string>(Object.values(INFRA_INTEGRATION_AUDIT_REASON))
const ALLOWED_SOURCES: ReadonlySet<string> = new Set<string>(Object.values(INFRA_INTEGRATION_AUDIT_SOURCE))

function assertClosedMetadata(metadata: InfraIntegrationAuditMetadata): void {
  const hasExtraKey = Object.keys(metadata).some((key) => !ALLOWED_METADATA_KEYS.has(key))
  if (hasExtraKey) throw new RangeError('Metadata de auditoria de integracao fora do formato fechado')
  if (!ALLOWED_REASONS.has(metadata.reason)) throw new RangeError('Motivo de auditoria de integracao invalido')
  if (metadata.source !== undefined && !ALLOWED_SOURCES.has(metadata.source)) {
    throw new RangeError('Origem de auditoria de integracao invalida')
  }
}

function pickClosedMetadata(metadata: InfraIntegrationAuditMetadata): InfraIntegrationAuditMetadata {
  return {
    reason: metadata.reason,
    ...(metadata.source !== undefined ? { source: metadata.source } : {}),
    ...(metadata.workspaceId !== undefined ? { workspaceId: metadata.workspaceId } : {}),
  }
}

/** Monta a entrada de auditoria da integracao: so campos fechados, nunca o token, a senha ou o cifrado. */
export function buildInfraIntegrationAuditEntry(params: BuildInfraIntegrationAuditEntryParams): InfraAuditEntry {
  if (!ALLOWED_ACTIONS.has(params.action)) throw new RangeError('Acao de auditoria de integracao invalida')
  assertClosedMetadata(params.metadata)

  return {
    actorType: params.actor.type,
    ...(params.actor.type === INFRA_AUDIT_ACTOR_TYPE.AGENT && params.actor.agentId
      ? { actorId: params.actor.agentId }
      : {}),
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
    action: params.action,
    targetType: INFRA_AUDIT_TARGET.INFRA_INTEGRATION,
    ...(params.targetId ? { targetId: params.targetId } : {}),
    metadata: pickClosedMetadata(params.metadata),
  }
}
