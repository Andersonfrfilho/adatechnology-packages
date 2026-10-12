/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraPasswordVerifierInterface } from './infraPasswordVerifier.types'
import type { InfraAuditRecorderInterface } from './infraAudit.types'
import type { InfraAccessStatus } from '../infra.constant'
import type { InfraCacheInterface } from './infraCache.interface'
import type {
  InfraIntegrationAuditAction,
  InfraIntegrationAuditMetadata,
  InfraIntegrationAuditReason,
} from './infraIntegrationAudit.types'
import type { InfraIntegrationRepositoryInterface } from './infraIntegrationRepository.interface'
import type { InfraLogger } from './infraRuntime.types'
import type { ProbeWorkspaceParams, ProbeWorkspaceResult } from './probeWorkspace.types'
import type {
  InfraIntegrationSource,
  InfraIntegrationState,
  RailwayGatewayProvider,
  RailwayGatewayProviderConfig,
} from './railwayGatewayProvider.types'

export type InfraIntegrationActor = { readonly agentId: string }

export type InfraIntegrationRecordAudit = InfraAuditRecorderInterface
export type InfraIntegrationVerifyPassword = InfraPasswordVerifierInterface

/** Nunca carrega o token, o texto cifrado nem o `keyId`. */
export type InfraIntegrationView = {
  readonly source: InfraIntegrationSource
  readonly state: InfraIntegrationState
  readonly tokenHint?: string
  readonly workspaceId?: string
  readonly updatedAt?: Date
  readonly updatedByName?: string
  readonly access?: InfraAccessStatus
  readonly environmentTokenAlsoPresent: boolean
}

export type SaveInfraIntegrationParams = {
  readonly actor: InfraIntegrationActor
  readonly ipAddress?: string
  readonly token: string
  readonly password: string
}

export type RemoveInfraIntegrationParams = {
  readonly actor: InfraIntegrationActor
  readonly ipAddress?: string
  readonly password: string
}

export type VerifyInfraIntegrationParams = {
  readonly actor: InfraIntegrationActor
  readonly ipAddress?: string
}

export type SaveInfraIntegrationResult = InfraIntegrationView
export type RemoveInfraIntegrationResult = InfraIntegrationView
export type GetInfraIntegrationResult = InfraIntegrationView
export type VerifyInfraIntegrationResult = { readonly access: InfraAccessStatus }

export type SaveInfraIntegrationDependencies = {
  readonly config: RailwayGatewayProviderConfig
  readonly integrationRepository: InfraIntegrationRepositoryInterface
  readonly gatewayProvider: Pick<RailwayGatewayProvider, 'invalidate' | 'describe'>
  readonly cache: InfraCacheInterface
  readonly verifyAgentPassword: InfraIntegrationVerifyPassword
  readonly probeWorkspace?: (params: ProbeWorkspaceParams) => Promise<ProbeWorkspaceResult>
  readonly recordAudit: InfraIntegrationRecordAudit
  readonly logger: InfraLogger
}

export type RemoveInfraIntegrationDependencies = Omit<SaveInfraIntegrationDependencies, 'probeWorkspace'>

export type VerifyInfraIntegrationDependencies = {
  readonly gatewayProvider: Pick<RailwayGatewayProvider, 'resolve' | 'isCurrent'>
  readonly cache: InfraCacheInterface
  readonly recordAudit: InfraIntegrationRecordAudit
  readonly logger: InfraLogger
}

export type GetInfraIntegrationDependencies = {
  readonly gatewayProvider: Pick<RailwayGatewayProvider, 'describe'>
  readonly cache: InfraCacheInterface
  readonly findAgentName?: (agentId: string) => Promise<string | undefined>
}

export type IntegrationAuditContext = {
  readonly recordAudit: InfraIntegrationRecordAudit
  readonly logger: InfraLogger
  readonly actor: InfraIntegrationActor
  readonly ipAddress?: string
}

export type RecordIntegrationAuditParams = {
  readonly context: IntegrationAuditContext
  readonly action: InfraIntegrationAuditAction
  readonly metadata: InfraIntegrationAuditMetadata
  readonly targetId?: string
}

export type RefuseIntegrationParams = {
  readonly context: IntegrationAuditContext
  readonly reason: InfraIntegrationAuditReason
  readonly error: Error
}

export type AssertIntegrationPreconditionsParams = {
  readonly context: IntegrationAuditContext
  readonly config: RailwayGatewayProviderConfig
  readonly verifyAgentPassword: InfraIntegrationVerifyPassword
  readonly password: string
  /** Salvar exige chave e ids do ambiente; remover so exige o que ja existe gravado. */
  readonly requiresStoreSetup: boolean
}

export type ProbeRefusal = {
  readonly reason: InfraIntegrationAuditReason
  readonly error: Error
}
