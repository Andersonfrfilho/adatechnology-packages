/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraDriver } from '../infraDriver.constant'
import type { InfraIntegrationRepositoryInterface } from './infraIntegrationRepository.interface'
import type { InfraLogger } from './infraRuntime.types'
import type { CreateInfraGatewayParams } from './infraGateway.types'
import type { InfraGatewayInterface } from './infraGateway.interface'

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

export interface InfraGatewayProvider {
  resolve(): Promise<InfraGatewayInterface | undefined>
  describe(): Promise<InfraIntegrationDescription>
  invalidate(): void
  /** `false` quando o gateway pertence a uma credencial já invalidada: resultado dele não pode ir para o cache. */
  isCurrent(gateway: InfraGatewayInterface): boolean
}

export type InfraGatewayProviderConfig = {
  /** Provedor de infraestrutura; ausente = Railway. */
  readonly driver?: InfraDriver
  readonly env: string
  readonly environmentToken: string
  readonly workspaceId: string
  readonly environmentId: string
  readonly encryptionKeyBase64: string
}

export type InfraGatewayProviderLogger = InfraLogger & {
  warn(message: string, meta: Readonly<Record<string, unknown>>): void
}

export type InfraGatewayProviderDependencies = {
  readonly config: InfraGatewayProviderConfig
  readonly integrationRepository: InfraIntegrationRepositoryInterface
  readonly buildGateway?: (params: CreateInfraGatewayParams) => InfraGatewayInterface | undefined
  readonly now: () => number
  readonly logger: InfraGatewayProviderLogger
  readonly rereadIntervalMilliseconds?: number
}

export type ResolvedIntegration = {
  readonly gateway: InfraGatewayInterface | undefined
  readonly description: InfraIntegrationDescription
  /** Impressão digital da credencial do painel; ausente quando não há gateway do painel. */
  readonly fingerprint?: string
}
