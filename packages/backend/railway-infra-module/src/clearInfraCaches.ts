/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
  INFRA_INVENTORY_CACHE_KEY,
} from '@adatechnology/railway-infra-contracts'
import type { InfraCacheInterface } from '@adatechnology/railway-infra-contracts'
import type { InfraLogger } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayProvider } from '@adatechnology/railway-infra-contracts'

// O veredito de verify entra junto: depois de trocar o token, um "ok" de 30 s do token antigo seria falso.
const CACHE_KEYS_TO_CLEAR = [
  INFRA_INVENTORY_CACHE_KEY,
  INFRA_ACCESS_CACHE_KEY,
  INFRA_COSTS_CACHE_KEY,
  INFRA_COSTS_LAST_GOOD_CACHE_KEY,
  INFRA_INTEGRATION_VERIFY_CACHE_KEY,
] as const

type ClearInfraCachesParams = {
  readonly gatewayProvider: Pick<RailwayGatewayProvider, 'invalidate'>
  readonly cache: InfraCacheInterface
  readonly logger: InfraLogger
}

/** Chamado depois de gravar: a falha do cache so loga, porque o segredo ja foi gravado e nada se desfaz. */
export async function clearInfraCaches(params: ClearInfraCachesParams): Promise<void> {
  const { gatewayProvider, cache, logger } = params
  gatewayProvider.invalidate()
  const results = await Promise.allSettled(CACHE_KEYS_TO_CLEAR.map((key) => cache.delete(key)))
  results.forEach((result, index) => {
    if (result.status === 'rejected')
      logger.error('infra.integration.cache_clear_failed', { key: CACHE_KEYS_TO_CLEAR[index] })
  })
}
