/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraEnvironmentClassification, InfraPowerDirection } from '../infra.constant'

export type RailwayServiceInstance = {
  readonly serviceId: string
  readonly serviceName: string
  readonly sourceImage?: string
  readonly latestDeploymentId?: string
  readonly activeDeploymentId?: string
  readonly hasDeployment: boolean
  readonly isStopped: boolean
  readonly instanceStatus?: string
}

export type RailwayEnvironment = {
  readonly id: string
  readonly name: string
  readonly services: readonly RailwayServiceInstance[]
}

export type RailwayProject = {
  readonly id: string
  readonly name: string
  readonly environments: readonly RailwayEnvironment[]
}

export type RailwayBillingCycle = {
  readonly start: string
  readonly end: string
  readonly currentUsage: number
}

export type RailwayUsageRow = {
  readonly measurement: string
  readonly value: number
  readonly projectId: string
  readonly environmentId: string
}

export type RailwayEstimatedUsageRow = {
  readonly measurement: string
  readonly estimatedValue: number
  readonly projectId: string
}

export type ClassifyEnvironmentParams = {
  readonly environmentName: string
  readonly environmentId: string
  readonly managedPattern: string
  readonly selfEnvironmentId: string
}

export type ClassifyEnvironmentResult = InfraEnvironmentClassification

export type OrderServicesForPowerParams = {
  readonly services: readonly RailwayServiceInstance[]
  readonly direction: InfraPowerDirection
}

export type OrderServicesForPowerResult = {
  readonly ordered: RailwayServiceInstance[]
}
