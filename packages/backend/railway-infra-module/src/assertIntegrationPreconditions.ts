/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import { InfraNotConfiguredError } from '@adatechnology/railway-infra-contracts'
import { INFRA_INTEGRATION_AUDIT_REASON as REASON } from '@adatechnology/railway-infra-contracts'
import {
  InfraIntegrationEnvironmentManagedError,
  InfraIntegrationLockedError,
  InfraIntegrationPasswordInvalidError,
  InfraIntegrationProductionOnlyError,
  InfraSecretKeyMissingError,
} from '@adatechnology/railway-infra-contracts'
import { recordIntegrationAudit, refuseIntegration } from './recordIntegrationAudit'
import type { AssertIntegrationPreconditionsParams } from '@adatechnology/railway-infra-contracts'

const PRODUCTION = 'production'

async function assertStoreConfigured(params: AssertIntegrationPreconditionsParams): Promise<void> {
  const { context, config } = params
  if (config.encryptionKeyBase64.length === 0) {
    return refuseIntegration({ context, reason: REASON.KEY_MISSING, error: new InfraSecretKeyMissingError() })
  }
  if (config.workspaceId.length === 0 || config.environmentId.length === 0) {
    return refuseIntegration({ context, reason: REASON.NOT_CONFIGURED, error: new InfraNotConfiguredError() })
  }
}

async function assertPasswordConfirmed(params: AssertIntegrationPreconditionsParams): Promise<void> {
  const { context, verifyAgentPassword, password } = params
  const result = await verifyAgentPassword.execute({ agentId: context.actor.agentId, password })
  if (result.outcome === 'confirmed') return
  if (result.outcome === 'invalid') {
    return refuseIntegration({
      context,
      reason: REASON.PASSWORD_INVALID,
      error: new InfraIntegrationPasswordInvalidError(),
    })
  }

  const error = new InfraIntegrationLockedError(result.retryAfterSeconds)
  if (!result.isNewLock) return refuseIntegration({ context, reason: REASON.LOCKED, error })
  await recordIntegrationAudit({
    context,
    action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_LOCKED,
    metadata: { reason: REASON.LOCKED },
  })
  throw error
}

/**
 * A ordem e parte do contrato: nada que dependa de rede ou de senha roda antes de producao, chave, ids e
 * variavel de ambiente, e a senha vem antes de qualquer chamada ao Railway.
 */
export async function assertIntegrationPreconditions(params: AssertIntegrationPreconditionsParams): Promise<void> {
  const { context, config } = params
  if (config.env !== PRODUCTION) {
    return refuseIntegration({
      context,
      reason: REASON.PRODUCTION_ONLY,
      error: new InfraIntegrationProductionOnlyError(),
    })
  }
  if (params.requiresStoreSetup) await assertStoreConfigured(params)
  if (config.environmentToken.length > 0) {
    return refuseIntegration({
      context,
      reason: REASON.ENVIRONMENT_MANAGED,
      error: new InfraIntegrationEnvironmentManagedError(),
    })
  }
  await assertPasswordConfirmed(params)
}
