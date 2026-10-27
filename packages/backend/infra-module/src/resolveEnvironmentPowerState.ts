/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_ENVIRONMENT_POWER_STATE,
  INFRA_SERVICE_POWER_STATE,
  type InfraEnvironmentPowerState,
  type InfraServicePowerState,
} from '@adatechnology/infra-contracts'

export function resolveEnvironmentPowerState(
  servicePowerStates: readonly InfraServicePowerState[],
): InfraEnvironmentPowerState {
  if (servicePowerStates.length === 0) return INFRA_ENVIRONMENT_POWER_STATE.STOPPED
  if (servicePowerStates.some((state) => state === INFRA_SERVICE_POWER_STATE.TRANSITIONING)) {
    return INFRA_ENVIRONMENT_POWER_STATE.TRANSITIONING
  }
  if (servicePowerStates.every((state) => state === INFRA_SERVICE_POWER_STATE.RUNNING)) {
    return INFRA_ENVIRONMENT_POWER_STATE.RUNNING
  }
  const isAllOff = servicePowerStates.every(
    (state) => state === INFRA_SERVICE_POWER_STATE.STOPPED || state === INFRA_SERVICE_POWER_STATE.NO_DEPLOYMENT,
  )
  return isAllOff ? INFRA_ENVIRONMENT_POWER_STATE.STOPPED : INFRA_ENVIRONMENT_POWER_STATE.PARTIAL
}
