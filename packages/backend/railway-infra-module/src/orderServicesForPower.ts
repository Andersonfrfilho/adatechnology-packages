/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_POWER_DIRECTION } from '@adatechnology/railway-infra-contracts'
import { isDatabaseService } from './isDatabaseService'
import type { OrderServicesForPowerParams, OrderServicesForPowerResult } from '@adatechnology/railway-infra-contracts'

export function orderServicesForPower(params: OrderServicesForPowerParams): OrderServicesForPowerResult {
  const { services, direction } = params
  const databases = services.filter(isDatabaseService)
  const applications = services.filter((service) => !isDatabaseService(service))
  const ordered =
    direction === INFRA_POWER_DIRECTION.OFF ? [...applications, ...databases] : [...databases, ...applications]
  return { ordered }
}
