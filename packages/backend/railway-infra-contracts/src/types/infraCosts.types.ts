/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraCostsWindowSource } from '../infra.constant'
import type { RailwayUsageMeasurement } from '../railwayPricing.constant'
import type { RailwayUsageRow } from './railwayInventory.types'

export type CalculateUsageCostParams = {
  readonly rows: readonly RailwayUsageRow[]
  readonly projectNames: ReadonlyMap<string, string>
  readonly environmentNames: ReadonlyMap<string, string>
}

export type EnvironmentCost = {
  readonly environmentId: string
  readonly environmentName: string
  readonly isProduction: boolean
  readonly cost: number
  readonly byMeasurement: Readonly<Record<RailwayUsageMeasurement, number>>
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
