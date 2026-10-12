/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraEnvironmentCost, InfraProjectCost } from '../types/infra.types'

export type CostChartSegment = {
  readonly projectId: string
  readonly projectName: string
  readonly stagingCost: number
  readonly productionCost: number
  readonly totalCost: number
  /** Fatia de homologacao dentro da propria barra, 0..1. */
  readonly stagingRatio: number
  readonly productionRatio: number
  /** Comprimento da barra em relacao a maior barra, 0..1: barras de projetos diferentes ficam comparaveis. */
  readonly lengthRatio: number
}

function sumCost(environments: readonly InfraEnvironmentCost[]): number {
  return environments.reduce((sum, environment) => sum + environment.cost, 0)
}

function divide({ numerator, denominator }: { readonly numerator: number; readonly denominator: number }): number {
  return denominator > 0 ? numerator / denominator : 0
}

export function computeShare({ cost, total }: { readonly cost: number; readonly total: number }): number {
  return divide({ numerator: cost, denominator: total })
}

export function sumMeasurementCost({
  environments,
  measurement,
}: {
  readonly environments: readonly InfraEnvironmentCost[]
  readonly measurement: string
}): number {
  return environments.reduce((sum, environment) => sum + (environment.byMeasurement[measurement] ?? 0), 0)
}

export function sortProjectsByCost(projects: readonly InfraProjectCost[]): readonly InfraProjectCost[] {
  return [...projects].sort((first, second) => second.cost - first.cost)
}

export function sortEnvironmentsByCost(environments: readonly InfraEnvironmentCost[]): readonly InfraEnvironmentCost[] {
  return [...environments].sort((first, second) => second.cost - first.cost)
}

/** Parcela do custo que nao e producao, 0..1. `undefined` quando nao ha custo para dividir. */
export function computeStagingShare({
  projects,
}: {
  readonly projects: readonly InfraProjectCost[]
}): number | undefined {
  const allEnvironments = projects.flatMap((project) => project.environments)
  const total = sumCost(allEnvironments)
  if (total <= 0) return undefined

  return sumCost(allEnvironments.filter((environment) => !environment.isProduction)) / total
}

export function buildChartSegments({
  projects,
}: {
  readonly projects: readonly InfraProjectCost[]
}): readonly CostChartSegment[] {
  const rows = sortProjectsByCost(projects).map((project) => {
    const stagingCost = sumCost(project.environments.filter((environment) => !environment.isProduction))
    const productionCost = sumCost(project.environments.filter((environment) => environment.isProduction))

    return { project, stagingCost, productionCost, totalCost: stagingCost + productionCost }
  })
  const largestTotal = Math.max(0, ...rows.map((row) => row.totalCost))

  return rows.map(({ project, stagingCost, productionCost, totalCost }) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    stagingCost,
    productionCost,
    totalCost,
    stagingRatio: divide({ numerator: stagingCost, denominator: totalCost }),
    productionRatio: divide({ numerator: productionCost, denominator: totalCost }),
    lengthRatio: divide({ numerator: totalCost, denominator: largestTotal }),
  }))
}
