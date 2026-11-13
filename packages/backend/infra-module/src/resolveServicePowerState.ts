/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_SERVICE_POWER_STATE, type InfraServicePowerState } from '@adatechnology/infra-contracts'
import type { InfraServiceInstance } from '@adatechnology/infra-contracts'

const RUNNING_INSTANCE_STATUS = 'RUNNING'

export function resolveServicePowerState(service: InfraServiceInstance): InfraServicePowerState {
  if (!service.hasDeployment) return INFRA_SERVICE_POWER_STATE.NO_DEPLOYMENT
  // O deployment parado continua com status SUCCESS; só deploymentStopped o distingue.
  if (service.isStopped) return INFRA_SERVICE_POWER_STATE.STOPPED
  if (service.instanceStatus === RUNNING_INSTANCE_STATUS) return INFRA_SERVICE_POWER_STATE.RUNNING
  return INFRA_SERVICE_POWER_STATE.TRANSITIONING
}
