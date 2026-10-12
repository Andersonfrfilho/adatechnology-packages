/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTOR_TYPE, INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import { buildInfraIntegrationAuditEntry } from './infraIntegrationAuditEntry'
import { recordInfraAudit } from './recordInfraAudit'
import type {
  IntegrationAuditContext,
  RecordIntegrationAuditParams,
  RefuseIntegrationParams,
} from '@adatechnology/railway-infra-contracts'

/** Metadata so passa pelo helper fechado; a falha de gravacao so loga (ver `recordInfraAudit`). */
export async function recordIntegrationAudit(params: RecordIntegrationAuditParams): Promise<void> {
  const { context, action, metadata, targetId } = params
  const entry = buildInfraIntegrationAuditEntry({
    action,
    actor: { type: INFRA_AUDIT_ACTOR_TYPE.AGENT, agentId: context.actor.agentId },
    ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
    ...(targetId ? { targetId } : {}),
    metadata,
  })
  await recordInfraAudit({ recordAudit: context.recordAudit, logger: context.logger, entry })
}

/** Toda recusa grava `infra.integration_denied` antes de lancar, e nunca chega perto do repositorio. */
export async function refuseIntegration(params: RefuseIntegrationParams): Promise<never> {
  await recordIntegrationAudit({
    context: params.context,
    action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_DENIED,
    metadata: { reason: params.reason },
  })
  throw params.error
}

export function buildIntegrationAuditContext(
  params: Pick<IntegrationAuditContext, 'recordAudit' | 'logger' | 'actor' | 'ipAddress'>,
): IntegrationAuditContext {
  return {
    recordAudit: params.recordAudit,
    logger: params.logger,
    actor: params.actor,
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
  }
}
