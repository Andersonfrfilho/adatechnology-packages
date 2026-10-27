/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const MINUTES_PER_MONTH = 43_200

export const INFRA_USAGE_MEASUREMENT = {
  CPU: 'CPU_USAGE',
  MEMORY: 'MEMORY_USAGE_GB',
  DISK: 'DISK_USAGE_GB',
  NETWORK_TX: 'NETWORK_TX_GB',
} as const
export type InfraUsageMeasurement = (typeof INFRA_USAGE_MEASUREMENT)[keyof typeof INFRA_USAGE_MEASUREMENT]

export const INFRA_USAGE_UNIT = {
  VCPU_MINUTE: 'vcpu_minute',
  GB_MINUTE: 'gb_minute',
  GB: 'gb',
} as const
export type InfraUsageUnit = (typeof INFRA_USAGE_UNIT)[keyof typeof INFRA_USAGE_UNIT]

export type InfraMeasurementPricing = {
  readonly unit: InfraUsageUnit
  readonly usdPerUnit: number
}

export type InfraPricingTable = Readonly<Record<InfraUsageMeasurement, InfraMeasurementPricing>>

/** Tabela de preço do provedor mais a fonte e a data da conferência, que a tela de custos exibe. */
export type InfraPricing = {
  readonly table: InfraPricingTable
  readonly source: string
  readonly checkedAt: string
}
