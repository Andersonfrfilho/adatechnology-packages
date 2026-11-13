/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraCostsWindowSource } from '../infra.constant'
import type { InfraPricing, InfraUsageMeasurement } from '../infraUsage.constant'
import type { InfraUsageRow } from './infraInventory.types'

export type CalculateUsageCostParams = {
  readonly rows: readonly InfraUsageRow[]
  readonly projectNames: ReadonlyMap<string, string>
  readonly environmentNames: ReadonlyMap<string, string>
  readonly pricing: InfraPricing
}

export type EnvironmentCost = {
  readonly environmentId: string
  readonly environmentName: string
  readonly isProduction: boolean
  readonly cost: number
  readonly byMeasurement: Readonly<Record<InfraUsageMeasurement, number>>
}

export type ProjectCost = {
  readonly projectId: string
  readonly projectName: string
  readonly cost: number
  readonly environments: readonly EnvironmentCost[]
}

export type CalculateUsageCostResult = {
  readonly totalCost: number
  readonly projects: readonly ProjectCost[]
}

export type CostsProject = {
  readonly projectId: string
  readonly projectName: string
  readonly cost: number
  readonly projected: number
  readonly environments: readonly EnvironmentCost[]
}

export type CostsResult = {
  readonly periodStart: string
  readonly periodEnd: string
  readonly windowSource: InfraCostsWindowSource
  readonly currency: 'USD'
  readonly totalCost: number
  readonly officialTotal?: number
  readonly divergencePercent?: number
  readonly isDivergent: boolean
  readonly projectedTotal: number
  readonly projectionMethod: 'linear'
  readonly projects: readonly CostsProject[]
  readonly pricingCheckedAt: string
  readonly pricingSource: string
  readonly isStale: boolean
}

export type ResolveCostsWindowResult = {
  readonly start: string
  readonly end: string
  readonly windowSource: InfraCostsWindowSource
  readonly officialTotal?: number
}
