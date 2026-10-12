/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_ACCESS_CACHE_KEY } from '@adatechnology/railway-infra-contracts'
import { buildIntegrationView } from './buildIntegrationView'
import { parseAccessStatus } from './infraAccessCache'
import type { GetInfraIntegrationDependencies, GetInfraIntegrationResult } from '@adatechnology/railway-infra-contracts'

/** So estado: o `access` vem do cache e o Railway nunca e chamado na abertura da tela. */
export class GetInfraIntegrationUseCase {
  constructor(private readonly dependencies: GetInfraIntegrationDependencies) {}

  async execute(): Promise<GetInfraIntegrationResult> {
    const { gatewayProvider, cache, findAgentName } = this.dependencies
    const description = await gatewayProvider.describe()
    const access = parseAccessStatus(await cache.get(INFRA_ACCESS_CACHE_KEY))
    const updatedByName =
      description.updatedByAgentId !== undefined && findAgentName
        ? await findAgentName(description.updatedByAgentId)
        : undefined
    return buildIntegrationView({ description, updatedByName, access })
  }
}
