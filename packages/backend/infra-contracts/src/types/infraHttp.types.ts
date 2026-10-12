/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraRateLimitProfile } from '../infraHttp.constant'
import type { CostsResult } from './infraCosts.types'
import type { GetInfraIntegrationResult } from './infraIntegrationUseCases.types'
import type {
  RemoveInfraIntegrationParams,
  RemoveInfraIntegrationResult,
  SaveInfraIntegrationParams,
  SaveInfraIntegrationResult,
  VerifyInfraIntegrationParams,
  VerifyInfraIntegrationResult,
} from './infraIntegrationUseCases.types'
import type { ListInfraEnvironmentsResult } from './infraListing.types'
import type {
  GetInfraOperationParams,
  GetInfraOperationResult,
  PowerEnvironmentParams,
  PowerEnvironmentResult,
} from './infraOperation.types'
import type { SaveEnvironmentScheduleParams, SaveEnvironmentScheduleResult } from './infraSchedule.types'

export type InfraRateLimitVerdict =
  { readonly isAllowed: true } | { readonly isAllowed: false; readonly retryAfterSeconds: number }

export type InfraRateLimitConsumeParams = {
  readonly bucket: string
  readonly identity: string
  readonly profile: InfraRateLimitProfile
}

/** Porta do host: limite por atendente já autenticado (o limite por IP é do transporte do host). */
export interface InfraRateLimiterInterface {
  consume(params: InfraRateLimitConsumeParams): Promise<InfraRateLimitVerdict>
}

export type InfraRoutesDependencies = {
  readonly listInfraEnvironments: { execute(): Promise<ListInfraEnvironmentsResult> }
  readonly powerOffEnvironment: { execute(params: PowerEnvironmentParams): Promise<PowerEnvironmentResult> }
  readonly powerOnEnvironment: { execute(params: PowerEnvironmentParams): Promise<PowerEnvironmentResult> }
  readonly getInfraOperation: { execute(params: GetInfraOperationParams): Promise<GetInfraOperationResult> }
  readonly getInfraCosts: { execute(): Promise<CostsResult> }
  readonly saveEnvironmentSchedule: {
    execute(params: SaveEnvironmentScheduleParams): Promise<SaveEnvironmentScheduleResult>
  }
  readonly getInfraIntegration: { execute(): Promise<GetInfraIntegrationResult> }
  readonly saveInfraIntegration: { execute(params: SaveInfraIntegrationParams): Promise<SaveInfraIntegrationResult> }
  readonly removeInfraIntegration: {
    execute(params: RemoveInfraIntegrationParams): Promise<RemoveInfraIntegrationResult>
  }
  readonly verifyInfraIntegration: {
    execute(params: VerifyInfraIntegrationParams): Promise<VerifyInfraIntegrationResult>
  }
  /** Ausente = sem limite por atendente (o host ainda aplica o limite por IP). */
  readonly rateLimiter?: InfraRateLimiterInterface
}
