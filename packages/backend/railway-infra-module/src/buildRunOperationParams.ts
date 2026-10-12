/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PowerEnvironmentParams, RunOperationParams } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type { RailwayEnvironment, RailwayProject } from '@adatechnology/railway-infra-contracts'

type BuildRunOperationParamsOptions = {
  readonly operationId: string
  readonly params: PowerEnvironmentParams
  readonly project: RailwayProject
  readonly environment: RailwayEnvironment
  readonly lockOwner: string
  readonly gateway: RailwayGatewayInterface
}

export function buildRunOperationParams(options: BuildRunOperationParamsOptions): RunOperationParams {
  const { operationId, params, project, environment, lockOwner, gateway } = options
  return {
    gateway,
    operationId,
    projectId: project.id,
    projectName: project.name,
    environmentId: environment.id,
    environmentName: environment.name,
    services: environment.services,
    actor: params.actor,
    trigger: params.trigger,
    lockOwner,
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
  }
}
