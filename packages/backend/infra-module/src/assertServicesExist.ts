/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraServiceNotFoundError } from '@adatechnology/infra-contracts'
import type { InfraEnvironment } from '@adatechnology/infra-contracts'

type AssertServicesExistParams = {
  readonly environment: InfraEnvironment
  readonly serviceIds: readonly string[] | undefined
}

/** Antes da trava e de qualquer operação: um id que não é do ambiente não pode deixar rastro. */
export function assertServicesExist(params: AssertServicesExistParams): void {
  const { environment, serviceIds } = params
  if (!serviceIds) return
  const known = new Set(environment.services.map((service) => service.serviceId))
  if (!serviceIds.every((serviceId) => known.has(serviceId))) throw new InfraServiceNotFoundError()
}
