/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraIntegrationRepositoryInterface } from './infraIntegrationRepository.interface'
import type { InfraLogger } from './infraRuntime.types'
import type { CreateRailwayGatewayParams } from './railwayGateway.types'
import type { RailwayGatewayInterface } from './railwayGateway.interface'

export type InfraIntegrationSource = 'environment' | 'panel' | 'none'

export const INFRA_INTEGRATION_STATE = {
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED: 'configured',
  KEY_MISSING: 'key_missing',
  KEY_MISMATCH: 'key_mismatch',
  SECRET_UNREADABLE: 'secret_unreadable',
  WORKSPACE_MISMATCH: 'workspace_mismatch',
  STORE_UNAVAILABLE: 'store_unavailable',
} as const
export type InfraIntegrationState = (typeof INFRA_INTEGRATION_STATE)[keyof typeof INFRA_INTEGRATION_STATE]

/** Nunca carrega o token nem o texto cifrado. */
export type InfraIntegrationDescription = {
  readonly source: InfraIntegrationSource
  readonly state: InfraIntegrationState
  readonly workspaceId?: string
  readonly tokenHint?: string
  readonly updatedAt?: Date
  readonly updatedByAgentId?: string
  readonly environmentTokenAlsoPresent: boolean
}

export interface RailwayGatewayProvider {
  resolve(): Promise<RailwayGatewayInterface | undefined>
  describe(): Promise<InfraIntegrationDescription>
  invalidate(): void
  /** `false` quando o gateway pertence a uma credencial já invalidada: resultado dele não pode ir para o cache. */
  isCurrent(gateway: RailwayGatewayInterface): boolean
}

export type RailwayGatewayProviderConfig = {
  readonly env: string
  readonly environmentToken: string
  readonly workspaceId: string
  readonly environmentId: string
  readonly encryptionKeyBase64: string
}

export type RailwayGatewayProviderLogger = InfraLogger & {
  warn(message: string, meta: Readonly<Record<string, unknown>>): void
}

export type RailwayGatewayProviderDependencies = {
  readonly config: RailwayGatewayProviderConfig
  readonly integrationRepository: InfraIntegrationRepositoryInterface
  readonly buildGateway?: (params: CreateRailwayGatewayParams) => RailwayGatewayInterface | undefined
  readonly now: () => number
  readonly logger: RailwayGatewayProviderLogger
  readonly rereadIntervalMilliseconds?: number
}

export type ResolvedIntegration = {
  readonly gateway: RailwayGatewayInterface | undefined
  readonly description: InfraIntegrationDescription
  /** Impressão digital da credencial do painel; ausente quando não há gateway do painel. */
  readonly fingerprint?: string
}
