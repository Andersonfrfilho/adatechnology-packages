/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { z } from 'zod'
import type { RailwayGatewayInterface } from './railwayGateway.interface'
import type { RailwayEnvironment, RailwayProject } from './railwayInventory.types'

export type GetEnvironmentServicesParams = { readonly environmentId: string }

export type StopDeploymentParams = { readonly deploymentId: string }

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

export type CreateRailwayGatewayParams = {
  readonly token: string
  readonly workspaceId: string
}

export type LocateManagedEnvironmentParams = {
  readonly railwayGateway: RailwayGatewayInterface
  readonly environmentId: string
  readonly managedPattern: string
  readonly selfEnvironmentId: string
}

export type LocatedEnvironment = {
  readonly project: RailwayProject
  readonly environment: RailwayEnvironment
}
