/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { isProductionEnvironmentName } from './classifyEnvironment'
import {
  RAILWAY_PRICING,
  RAILWAY_USAGE_MEASUREMENT,
  type RailwayUsageMeasurement,
} from '@adatechnology/railway-infra-contracts'
import type {
  CalculateUsageCostParams,
  CalculateUsageCostResult,
  EnvironmentCost,
  ProjectCost,
} from '@adatechnology/railway-infra-contracts'

const MEASUREMENTS = Object.values(RAILWAY_USAGE_MEASUREMENT) as readonly string[]

function isKnownMeasurement(measurement: string): measurement is RailwayUsageMeasurement {
  return MEASUREMENTS.includes(measurement)
}

function emptyByMeasurement(): Record<RailwayUsageMeasurement, number> {
  return { CPU_USAGE: 0, MEMORY_USAGE_GB: 0, DISK_USAGE_GB: 0, NETWORK_TX_GB: 0 }
}

function sumValues(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Valores cheios: o arredondamento fica para a apresentacao, senao o erro se acumula na soma. */
export function calculateUsageCost(params: CalculateUsageCostParams): CalculateUsageCostResult {
  const { rows, projectNames, environmentNames } = params
  const environmentsByProject = new Map<string, Map<string, Record<RailwayUsageMeasurement, number>>>()

  for (const row of rows) {
    if (!isKnownMeasurement(row.measurement)) continue

    const environments = environmentsByProject.get(row.projectId) ?? new Map()
    const byMeasurement = environments.get(row.environmentId) ?? emptyByMeasurement()
    byMeasurement[row.measurement] += row.value * RAILWAY_PRICING[row.measurement].usdPerUnit
    environments.set(row.environmentId, byMeasurement)
    environmentsByProject.set(row.projectId, environments)
  }

  const projects: ProjectCost[] = [...environmentsByProject].map(([projectId, environmentMap]) => {
    const environments: EnvironmentCost[] = [...environmentMap].map(([environmentId, byMeasurement]) => {
      const environmentName = environmentNames.get(environmentId) ?? environmentId
      return {
        environmentId,
        environmentName,
        isProduction: isProductionEnvironmentName(environmentName),
        cost: sumValues(Object.values(byMeasurement)),
        byMeasurement,
      }
    })

    return {
      projectId,
      projectName: projectNames.get(projectId) ?? projectId,
      cost: sumValues(environments.map((environment) => environment.cost)),
      environments,
    }
  })

  return { totalCost: sumValues(projects.map((project) => project.cost)), projects }
}
