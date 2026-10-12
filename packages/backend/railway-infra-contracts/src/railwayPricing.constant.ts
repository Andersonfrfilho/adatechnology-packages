/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const MINUTES_PER_MONTH = 43_200

export const RAILWAY_USAGE_MEASUREMENT = {
  CPU: 'CPU_USAGE',
  MEMORY: 'MEMORY_USAGE_GB',
  DISK: 'DISK_USAGE_GB',
  NETWORK_TX: 'NETWORK_TX_GB',
} as const
export type RailwayUsageMeasurement = (typeof RAILWAY_USAGE_MEASUREMENT)[keyof typeof RAILWAY_USAGE_MEASUREMENT]

export const RAILWAY_USAGE_UNIT = {
  VCPU_MINUTE: 'vcpu_minute',
  GB_MINUTE: 'gb_minute',
  GB: 'gb',
} as const
export type RailwayUsageUnit = (typeof RAILWAY_USAGE_UNIT)[keyof typeof RAILWAY_USAGE_UNIT]

export type RailwayMeasurementPricing = {
  readonly unit: RailwayUsageUnit
  readonly usdPerUnit: number
}

export const RAILWAY_PRICING: Readonly<Record<RailwayUsageMeasurement, RailwayMeasurementPricing>> = {
  [RAILWAY_USAGE_MEASUREMENT.CPU]: { unit: RAILWAY_USAGE_UNIT.VCPU_MINUTE, usdPerUnit: 20 / MINUTES_PER_MONTH },
  [RAILWAY_USAGE_MEASUREMENT.MEMORY]: { unit: RAILWAY_USAGE_UNIT.GB_MINUTE, usdPerUnit: 10 / MINUTES_PER_MONTH },
  [RAILWAY_USAGE_MEASUREMENT.DISK]: { unit: RAILWAY_USAGE_UNIT.GB_MINUTE, usdPerUnit: 0.15 / MINUTES_PER_MONTH },
  [RAILWAY_USAGE_MEASUREMENT.NETWORK_TX]: { unit: RAILWAY_USAGE_UNIT.GB, usdPerUnit: 0.05 },
}

export const RAILWAY_PRICING_SOURCE = 'https://docs.railway.com/pricing/plans'
export const RAILWAY_PRICING_CHECKED_AT = '2026-10-09'
