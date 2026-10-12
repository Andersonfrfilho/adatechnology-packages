/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RailwayGateway } from './RailwayGateway'
import type { CreateInfraGatewayParams } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'

export function createRailwayGateway(params: CreateInfraGatewayParams): InfraGatewayInterface | undefined {
  // Token vazio desliga o módulo: os use cases lançam InfraNotConfiguredError quando o gateway é undefined.
  if (params.token.length === 0) return undefined
  return new RailwayGateway({ token: params.token, workspaceId: params.workspaceId })
}
