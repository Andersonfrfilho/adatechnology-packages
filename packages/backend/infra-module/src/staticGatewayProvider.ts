/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_INTEGRATION_STATE } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { InfraGatewayProvider } from '@adatechnology/infra-contracts'

export function buildStaticGatewayProvider(gateway: InfraGatewayInterface | undefined): InfraGatewayProvider {
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
