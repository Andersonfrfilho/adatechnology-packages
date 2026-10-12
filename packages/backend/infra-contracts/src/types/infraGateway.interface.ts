/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraPricing } from '../infraUsage.constant'
import type { InfraAccessStatus } from '../infra.constant'
import type {
  GetEnvironmentServicesParams,
  GetUsageParams,
  RedeployServiceParams,
  RestartDeploymentParams,
  StopDeploymentParams,
} from './infraGateway.types'
import type {
  InfraBillingCycle,
  InfraEstimatedUsageRow,
  InfraProject,
  InfraServiceInstance,
  InfraUsageRow,
} from './infraInventory.types'

export interface InfraGatewayInterface {
  /** Tabela de preço do provedor: o cálculo de custo é do módulo, o preço é de quem cobra. */
  readonly pricing: InfraPricing
  listInventory(): Promise<readonly InfraProject[]>
  /** Leitura de um ambiente só, sem cache: a espera dos bancos depende do estado de agora. */
  getEnvironmentServices(params: GetEnvironmentServicesParams): Promise<readonly InfraServiceInstance[]>
  stopDeployment(params: StopDeploymentParams): Promise<void>
  restartDeployment(params: RestartDeploymentParams): Promise<void>
  redeployService(params: RedeployServiceParams): Promise<void>
  getBillingCycle(): Promise<InfraBillingCycle>
  getUsage(params: GetUsageParams): Promise<readonly InfraUsageRow[]>
  getEstimatedUsage(): Promise<readonly InfraEstimatedUsageRow[]>
  /** Nao lanca: qualquer falha vira um status. */
  verifyAccess(): Promise<InfraAccessStatus>
}
