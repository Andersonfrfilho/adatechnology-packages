/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraEnvironmentClassification, InfraPowerDirection } from '../infra.constant'

export type InfraServiceInstance = {
  readonly serviceId: string
  readonly serviceName: string
  readonly sourceImage?: string
  readonly latestDeploymentId?: string
  readonly activeDeploymentId?: string
  /** Pode haver mais de um deployment ativo ao mesmo tempo: parar só o primeiro deixa o serviço no ar. */
  readonly activeDeploymentIds?: readonly string[]
  readonly hasDeployment: boolean
  readonly isStopped: boolean
  /** Deployment removido: subir de novo exige redeploy, e não restart. */
  readonly isRemoved?: boolean
  readonly instanceStatus?: string
}

export type InfraEnvironment = {
  readonly id: string
  readonly name: string
  readonly services: readonly InfraServiceInstance[]
}

export type InfraProject = {
  readonly id: string
  readonly name: string
  readonly environments: readonly InfraEnvironment[]
}

export type InfraBillingCycle = {
  readonly start: string
  readonly end: string
  readonly currentUsage: number
}

export type InfraUsageRow = {
  readonly measurement: string
  readonly value: number
  readonly projectId: string
  readonly environmentId: string
}

export type InfraEstimatedUsageRow = {
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
  readonly services: readonly InfraServiceInstance[]
  readonly direction: InfraPowerDirection
}

export type OrderServicesForPowerResult = {
  readonly ordered: InfraServiceInstance[]
}
