/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraIntegrationProvider } from '../infra.constant'

export type InfraIntegrationRecord = {
  readonly id: string
  readonly provider: string
  readonly workspaceId: string
  readonly ciphertext: string
  readonly keyId: string
  readonly tokenHint: string
  readonly updatedByAgentId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type UpsertLockedIntegrationParams = {
  readonly provider: InfraIntegrationProvider
  readonly workspaceId: string
  readonly ciphertext: string
  readonly keyId: string
  readonly tokenHint: string
  readonly agentId?: string
}

export type UpsertLockedIntegrationResult = {
  readonly record: InfraIntegrationRecord
  readonly wasReplacement: boolean
}
