/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_USAGE_MEASUREMENT,
  INFRA_USAGE_UNIT,
  MINUTES_PER_MONTH,
  type InfraPricing,
  type InfraPricingTable,
} from '@adatechnology/infra-contracts'

export const RAILWAY_PRICING: InfraPricingTable = {
  [INFRA_USAGE_MEASUREMENT.CPU]: { unit: INFRA_USAGE_UNIT.VCPU_MINUTE, usdPerUnit: 20 / MINUTES_PER_MONTH },
  [INFRA_USAGE_MEASUREMENT.MEMORY]: { unit: INFRA_USAGE_UNIT.GB_MINUTE, usdPerUnit: 10 / MINUTES_PER_MONTH },
  [INFRA_USAGE_MEASUREMENT.DISK]: { unit: INFRA_USAGE_UNIT.GB_MINUTE, usdPerUnit: 0.15 / MINUTES_PER_MONTH },
  [INFRA_USAGE_MEASUREMENT.NETWORK_TX]: { unit: INFRA_USAGE_UNIT.GB, usdPerUnit: 0.05 },
}

export const RAILWAY_INFRA_PRICING: InfraPricing = {
  table: RAILWAY_PRICING,
  source: 'https://docs.railway.com/pricing/plans',
  checkedAt: '2026-10-09',
}
