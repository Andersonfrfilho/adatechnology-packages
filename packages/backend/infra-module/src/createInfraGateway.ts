/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_DRIVER } from '@adatechnology/infra-contracts'
import type { CreateInfraGatewayParams, InfraGatewayInterface } from '@adatechnology/infra-contracts'

import { createRailwayGateway } from './drivers/railway/createRailwayGateway'

/** Registro de drivers: o resto do módulo só conhece `InfraGatewayInterface`. */
export function createInfraGateway(params: CreateInfraGatewayParams): InfraGatewayInterface | undefined {
  const { driver = INFRA_DRIVER.RAILWAY, ...credentials } = params
  switch (driver) {
    case INFRA_DRIVER.RAILWAY:
      return createRailwayGateway(credentials)
  }
}
