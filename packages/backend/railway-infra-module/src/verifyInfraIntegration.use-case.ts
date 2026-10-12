/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_AUDIT_ACTION } from '@adatechnology/railway-infra-contracts'
import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_ACCESS_STATUS,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_TTL_SECONDS,
  type InfraAccessStatus,
} from '@adatechnology/railway-infra-contracts'
import { InfraNotConfiguredError } from '@adatechnology/railway-infra-contracts'
import { parseAccessStatus, resolveAccessCacheTtlSeconds } from './infraAccessCache'
import { INFRA_INTEGRATION_AUDIT_REASON } from '@adatechnology/railway-infra-contracts'
import { buildIntegrationAuditContext, recordIntegrationAudit } from './recordIntegrationAudit'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type {
  VerifyInfraIntegrationDependencies,
  VerifyInfraIntegrationParams,
  VerifyInfraIntegrationResult,
} from '@adatechnology/railway-infra-contracts'

export class VerifyInfraIntegrationUseCase {
  constructor(private readonly dependencies: VerifyInfraIntegrationDependencies) {}

  async execute(params: VerifyInfraIntegrationParams): Promise<VerifyInfraIntegrationResult> {
    const { gatewayProvider, recordAudit, logger } = this.dependencies
    const gateway = await gatewayProvider.resolve()
    if (!gateway) throw new InfraNotConfiguredError()

    const access = await this.resolveAccess(gateway)
    await recordIntegrationAudit({
      context: buildIntegrationAuditContext({
        recordAudit,
        logger,
        actor: params.actor,
        ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      }),
      action: INFRA_AUDIT_ACTION.INFRA_INTEGRATION_VERIFIED,
      metadata: {
        reason:
          access === INFRA_ACCESS_STATUS.OK
            ? INFRA_INTEGRATION_AUDIT_REASON.VERIFIED_OK
            : INFRA_INTEGRATION_AUDIT_REASON.VERIFIED_FAILED,
      },
    })
    return { access }
  }

  // Veredito de 30 s por cima de tudo: repetir o clique nao esgota a cota horaria do token no Railway.
  private async resolveAccess(gateway: RailwayGatewayInterface): Promise<InfraAccessStatus> {
    const { cache, gatewayProvider } = this.dependencies
    const cached = parseAccessStatus(await cache.get(INFRA_INTEGRATION_VERIFY_CACHE_KEY))
    if (cached) return cached

    const access = await gateway.verifyAccess()
    // Token trocado durante a chamada: o veredito é da credencial antiga e não pode ser servido à nova.
    if (!gatewayProvider.isCurrent(gateway)) return access
    await cache.set(INFRA_INTEGRATION_VERIFY_CACHE_KEY, access, INFRA_INTEGRATION_VERIFY_CACHE_TTL_SECONDS)
    const accessTtlSeconds = resolveAccessCacheTtlSeconds(access)
    if (accessTtlSeconds !== undefined) await cache.set(INFRA_ACCESS_CACHE_KEY, access, accessTtlSeconds)
    return access
  }
}
