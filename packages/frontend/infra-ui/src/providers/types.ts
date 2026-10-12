/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * `InfraApi` é a fronteira com o host: o pacote nunca faz fetch. Cada método é uma capacidade
 * opcional — o que o host não implementa não desenha o affordance correspondente.
 */

import type {
  GetInfraOperationParams,
  InfraCosts,
  InfraOperation,
  ListInfraEnvironmentsResult,
  PowerEnvironmentResult,
  PowerOffEnvironmentParams,
  PowerOnEnvironmentParams,
  SaveEnvironmentScheduleParams,
  SaveEnvironmentScheduleResult,
} from '../types/infra.types'
import type {
  InfraIntegrationView,
  RemoveInfraIntegrationParams,
  SaveInfraIntegrationParams,
  VerifyInfraIntegrationResult,
} from '../types/infraIntegration.types'

export type InfraApi = {
  listEnvironments?(): Promise<ListInfraEnvironmentsResult>
  powerOffEnvironment?(params: PowerOffEnvironmentParams): Promise<PowerEnvironmentResult>
  powerOnEnvironment?(params: PowerOnEnvironmentParams): Promise<PowerEnvironmentResult>
  getOperation?(params: GetInfraOperationParams): Promise<InfraOperation>
  saveSchedule?(params: SaveEnvironmentScheduleParams): Promise<SaveEnvironmentScheduleResult>
  getCosts?(): Promise<InfraCosts>
  getIntegration?(): Promise<InfraIntegrationView>
  saveIntegration?(params: SaveInfraIntegrationParams): Promise<InfraIntegrationView>
  verifyIntegration?(): Promise<VerifyInfraIntegrationResult>
  removeIntegration?(params: RemoveInfraIntegrationParams): Promise<InfraIntegrationView>
}

export type InfraCapabilities = {
  readonly hasEnvironments: boolean
  readonly canPower: boolean
  readonly canSaveSchedule: boolean
  readonly hasCosts: boolean
  readonly hasIntegration: boolean
  readonly canSaveIntegration: boolean
  readonly canVerifyIntegration: boolean
  readonly canRemoveIntegration: boolean
}

export type InfraTokenSource = {
  readonly url: string
  readonly label: string
}
