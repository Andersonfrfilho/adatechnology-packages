/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { classifyEnvironment } from './classifyEnvironment'
import { INFRA_ENVIRONMENT_CLASSIFICATION } from '@adatechnology/infra-contracts'
import { InfraEnvironmentNotFoundError, InfraEnvironmentProtectedError } from '@adatechnology/infra-contracts'
import type { LocateManagedEnvironmentParams, LocatedEnvironment } from '@adatechnology/infra-contracts'

/** Inventario fresco, sem cache: a decisao de mexer no ambiente nao pode usar leitura de 30 s atras. */
export async function locateManagedEnvironment(params: LocateManagedEnvironmentParams): Promise<LocatedEnvironment> {
  const { gateway, environmentId, managedPattern, selfEnvironmentId } = params
  const inventory = await gateway.listInventory()

  for (const project of inventory) {
    const environment = project.environments.find((candidate) => candidate.id === environmentId)
    if (!environment) continue

    const classification = classifyEnvironment({
      environmentName: environment.name,
      environmentId: environment.id,
      managedPattern,
      selfEnvironmentId,
    })
    if (classification !== INFRA_ENVIRONMENT_CLASSIFICATION.MANAGED) throw new InfraEnvironmentProtectedError()

    return { project, environment }
  }

  throw new InfraEnvironmentNotFoundError()
}
