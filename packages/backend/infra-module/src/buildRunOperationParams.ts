/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { PowerEnvironmentParams, RunOperationParams } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { InfraEnvironment, InfraProject } from '@adatechnology/infra-contracts'

type BuildRunOperationParamsOptions = {
  readonly operationId: string
  readonly params: PowerEnvironmentParams
  readonly project: InfraProject
  readonly environment: InfraEnvironment
  readonly lockOwner: string
  readonly gateway: InfraGatewayInterface
}

function selectedServices(
  services: InfraEnvironment['services'],
  serviceIds: PowerEnvironmentParams['serviceIds'],
): InfraEnvironment['services'] {
  if (!serviceIds) return services
  const wanted = new Set(serviceIds)
  return services.filter((service) => wanted.has(service.serviceId))
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
    services: selectedServices(environment.services, params.serviceIds),
    environmentServices: environment.services,
    actor: params.actor,
    trigger: params.trigger,
    lockOwner,
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
  }
}
