/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraDriver } from '../infraDriver.constant'
import type { z } from 'zod'
import type { InfraGatewayInterface } from './infraGateway.interface'
import type { InfraEnvironment, InfraProject } from './infraInventory.types'

export type GetEnvironmentServicesParams = { readonly environmentId: string }

export type StopDeploymentParams = { readonly deploymentId: string }

export type RemoveDeploymentParams = { readonly deploymentId: string }

export type RestartDeploymentParams = { readonly deploymentId: string }

export type RedeployServiceParams = { readonly environmentId: string; readonly serviceId: string }

export type GetUsageParams = { readonly startDate: string; readonly endDate: string }

export type RailwayGatewayDependencies = {
  readonly token: string
  readonly workspaceId: string
  readonly fetchImplementation?: typeof fetch
  readonly now?: () => number
}

export type ResolveRateLimitWaitSecondsParams = {
  readonly headers: Headers
  readonly nowMilliseconds: number
}

export type ResolveRateLimitWaitSecondsResult = {
  readonly seconds: number
}

export type ExecuteRailwayParams<TData> = {
  readonly operationName: string
  readonly query: string
  readonly variables: Readonly<Record<string, unknown>>
  readonly schema: z.ZodType<TData>
}

export type CreateInfraGatewayParams = {
  readonly driver?: InfraDriver
  readonly token: string
  readonly workspaceId: string
}

export type LocateManagedEnvironmentParams = {
  readonly gateway: InfraGatewayInterface
  readonly environmentId: string
  readonly managedPattern: string
  readonly selfEnvironmentId: string
}

export type LocatedEnvironment = {
  readonly project: InfraProject
  readonly environment: InfraEnvironment
}
