/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import { INFRA_INTEGRATION_PROVIDER } from '@adatechnology/railway-infra-contracts'
import { assertIntegrationPreconditions } from './assertIntegrationPreconditions'
import { buildIntegrationView } from './buildIntegrationView'
import { clearInfraCaches } from './clearInfraCaches'
import { INFRA_INTEGRATION_AUDIT_REASON, INFRA_INTEGRATION_AUDIT_SOURCE } from '@adatechnology/railway-infra-contracts'
import { buildIntegrationAuditContext, recordIntegrationAudit } from './recordIntegrationAudit'
import { INFRA_INTEGRATION_STATE } from '@adatechnology/railway-infra-contracts'
import type {
  RemoveInfraIntegrationDependencies,
  RemoveInfraIntegrationParams,
  RemoveInfraIntegrationResult,
} from '@adatechnology/railway-infra-contracts'

export class RemoveInfraIntegrationUseCase {
  constructor(private readonly dependencies: RemoveInfraIntegrationDependencies) {}

  async execute(params: RemoveInfraIntegrationParams): Promise<RemoveInfraIntegrationResult> {
    const { config, verifyAgentPassword, integrationRepository, gatewayProvider, cache, logger, recordAudit } =
      this.dependencies
    const context = buildIntegrationAuditContext({
      recordAudit,
      logger,
      actor: params.actor,
      ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
    })

    await assertIntegrationPreconditions({
      context,
      config,
      verifyAgentPassword,
      password: params.password,
      requiresStoreSetup: false,
    })

    const wasRemoved = await integrationRepository.deleteLocked(INFRA_INTEGRATION_PROVIDER.RAILWAY)
    // Idempotente: sem linha nao ha o que invalidar nem o que auditar.
    if (!wasRemoved) {
      return buildIntegrationView({
        description: {
          source: 'none',
          state: INFRA_INTEGRATION_STATE.NOT_CONFIGURED,
          environmentTokenAlsoPresent: false,
        },
      })
    }

    await clearInfraCaches({ gatewayProvider, cache, logger })
    await recordIntegrationAudit({
      context,
      action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_REMOVED,
      metadata: { reason: INFRA_INTEGRATION_AUDIT_REASON.REMOVED, source: INFRA_INTEGRATION_AUDIT_SOURCE.PANEL },
    })

    return buildIntegrationView({ description: await gatewayProvider.describe() })
  }
}
