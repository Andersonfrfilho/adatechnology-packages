/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAccessStatus } from '../infra.constant'
import type {
  GetEnvironmentServicesParams,
  GetUsageParams,
  RedeployServiceParams,
  RestartDeploymentParams,
  StopDeploymentParams,
} from './railwayGateway.types'
import type {
  RailwayBillingCycle,
  RailwayEstimatedUsageRow,
  RailwayProject,
  RailwayServiceInstance,
  RailwayUsageRow,
} from './railwayInventory.types'

export interface RailwayGatewayInterface {
  listInventory(): Promise<readonly RailwayProject[]>
  /** Leitura de um ambiente só, sem cache: a espera dos bancos depende do estado de agora. */
  getEnvironmentServices(params: GetEnvironmentServicesParams): Promise<readonly RailwayServiceInstance[]>
  stopDeployment(params: StopDeploymentParams): Promise<void>
  restartDeployment(params: RestartDeploymentParams): Promise<void>
  redeployService(params: RedeployServiceParams): Promise<void>
  getBillingCycle(): Promise<RailwayBillingCycle>
  getUsage(params: GetUsageParams): Promise<readonly RailwayUsageRow[]>
  getEstimatedUsage(): Promise<readonly RailwayEstimatedUsageRow[]>
  /** Nao lanca: qualquer falha vira um status. */
  verifyAccess(): Promise<InfraAccessStatus>
}
