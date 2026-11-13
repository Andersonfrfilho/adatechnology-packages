/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAccessStatus } from '../constants/infra.constant'
import type { InfraIntegrationSource, InfraIntegrationState } from '../constants/infraIntegration.constant'

export type InfraIntegrationView = {
  readonly source: InfraIntegrationSource
  readonly state: InfraIntegrationState
  readonly tokenHint?: string
  readonly workspaceId?: string
  readonly updatedAt?: string
  readonly updatedByName?: string
  readonly access?: InfraAccessStatus
  readonly environmentTokenAlsoPresent: boolean
}

export type SaveInfraIntegrationParams = {
  readonly token: string
  readonly password: string
}

export type RemoveInfraIntegrationParams = {
  readonly password: string
}

export type VerifyInfraIntegrationResult = {
  readonly access: InfraAccessStatus
}
