/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_INTEGRATION_STATE } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayProvider } from '@adatechnology/railway-infra-contracts'

export function buildStaticGatewayProvider(gateway: RailwayGatewayInterface | undefined): RailwayGatewayProvider {
  return {
    resolve: async () => gateway,
    describe: async () => ({
      source: gateway ? 'environment' : 'none',
      state: gateway ? INFRA_INTEGRATION_STATE.CONFIGURED : INFRA_INTEGRATION_STATE.NOT_CONFIGURED,
      environmentTokenAlsoPresent: false,
    }),
    invalidate: () => undefined,
    isCurrent: () => true,
  }
}
