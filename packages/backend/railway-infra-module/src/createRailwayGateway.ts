/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { RailwayGateway } from './RailwayGateway'
import type { CreateRailwayGatewayParams } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'

export function createRailwayGateway(params: CreateRailwayGatewayParams): RailwayGatewayInterface | undefined {
  // Token vazio desliga o módulo: os use cases lançam InfraNotConfiguredError quando o gateway é undefined.
  if (params.token.length === 0) return undefined
  return new RailwayGateway({ token: params.token, workspaceId: params.workspaceId })
}
