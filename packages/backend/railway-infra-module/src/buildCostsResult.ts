/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { calculateUsageCost } from './calculateUsageCost'
import { INFRA_COSTS_DIVERGENCE_THRESHOLD_PERCENT } from '@adatechnology/railway-infra-contracts'
import { RAILWAY_PRICING_CHECKED_AT, RAILWAY_PRICING_SOURCE } from '@adatechnology/railway-infra-contracts'
import type {
  CalculateUsageCostResult,
  CostsProject,
  CostsResult,
  ResolveCostsWindowResult,
} from '@adatechnology/railway-infra-contracts'
import type { RailwayProject, RailwayUsageRow } from '@adatechnology/railway-infra-contracts'

const CURRENCY_DECIMALS = 10_000
const PERCENT_DECIMALS = 100

type BuildCostsResultParams = {
  readonly window: ResolveCostsWindowResult
  readonly rows: readonly RailwayUsageRow[]
  readonly inventory: readonly RailwayProject[]
  readonly now: Date
}

// Arredonda so na apresentacao (4 casas); o calculo e a divergencia usam o numero cheio.
function roundCurrency(value: number): number {
  return Math.round(value * CURRENCY_DECIMALS) / CURRENCY_DECIMALS
}

function resolveProjectionFactor(params: { readonly window: ResolveCostsWindowResult; readonly now: Date }): number {
  const start = new Date(params.window.start).getTime()
  const end = new Date(params.window.end).getTime()
  const elapsed = params.now.getTime() - start
  if (elapsed <= 0 || elapsed >= end - start) return 1
  return (end - start) / elapsed
}

function buildProjects(params: {
  readonly projects: CalculateUsageCostResult['projects']
  readonly projectionFactor: number
}): CostsProject[] {
  return params.projects.map((project) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    cost: roundCurrency(project.cost),
    projected: roundCurrency(project.cost * params.projectionFactor),
    environments: project.environments.map((environment) => ({
      ...environment,
      cost: roundCurrency(environment.cost),
      byMeasurement: {
        CPU_USAGE: roundCurrency(environment.byMeasurement.CPU_USAGE),
        MEMORY_USAGE_GB: roundCurrency(environment.byMeasurement.MEMORY_USAGE_GB),
        DISK_USAGE_GB: roundCurrency(environment.byMeasurement.DISK_USAGE_GB),
        NETWORK_TX_GB: roundCurrency(environment.byMeasurement.NETWORK_TX_GB),
      },
    })),
  }))
}

export function buildCostsResult(params: BuildCostsResultParams): CostsResult {
  const { window, rows, inventory, now } = params
  const projectNames = new Map(inventory.map((project) => [project.id, project.name]))
  const environmentNames = new Map(
    inventory.flatMap((project) => project.environments.map((environment) => [environment.id, environment.name])),
  )
  const calculated = calculateUsageCost({ rows, projectNames, environmentNames })
  const projectionFactor = resolveProjectionFactor({ window, now })
  const { officialTotal } = window
  const divergence =
    officialTotal !== undefined && officialTotal > 0
      ? (Math.abs(calculated.totalCost - officialTotal) / officialTotal) * 100
      : undefined

  return {
    periodStart: window.start,
    periodEnd: window.end,
    windowSource: window.windowSource,
    currency: 'USD',
    totalCost: roundCurrency(calculated.totalCost),
    ...(officialTotal !== undefined ? { officialTotal } : {}),
    ...(divergence !== undefined
      ? { divergencePercent: Math.round(divergence * PERCENT_DECIMALS) / PERCENT_DECIMALS }
      : {}),
    isDivergent: divergence !== undefined && divergence > INFRA_COSTS_DIVERGENCE_THRESHOLD_PERCENT,
    projectedTotal: roundCurrency(calculated.totalCost * projectionFactor),
    projectionMethod: 'linear',
    projects: buildProjects({ projects: calculated.projects, projectionFactor }),
    pricingCheckedAt: RAILWAY_PRICING_CHECKED_AT,
    pricingSource: RAILWAY_PRICING_SOURCE,
    isStale: false,
  }
}
