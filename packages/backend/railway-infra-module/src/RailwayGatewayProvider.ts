/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_INTEGRATION_PROVIDER } from '@adatechnology/railway-infra-contracts'
import { createRailwayGateway } from './createRailwayGateway'
import { resolvePanelCredential } from './resolvePanelCredential'
import { INFRA_INTEGRATION_STATE } from '@adatechnology/railway-infra-contracts'
import type { InfraIntegrationRecord } from '@adatechnology/railway-infra-contracts'
import type { RailwayGatewayInterface } from '@adatechnology/railway-infra-contracts'
import type {
  InfraIntegrationDescription,
  InfraIntegrationState,
  RailwayGatewayProvider,
  RailwayGatewayProviderDependencies,
  ResolvedIntegration,
} from '@adatechnology/railway-infra-contracts'

const PRODUCTION = 'production'
const DEFAULT_REREAD_INTERVAL_MILLISECONDS = 30_000

type CachedResolution = { readonly resolved: ResolvedIntegration; readonly expiresAt: number }
type LastPanelGateway = { readonly fingerprint: string; readonly gateway: RailwayGatewayInterface }

function buildFingerprint(record: InfraIntegrationRecord): string {
  return `${record.updatedAt.toISOString()}|${record.keyId}|${record.workspaceId}`
}

export class DefaultRailwayGatewayProvider implements RailwayGatewayProvider {
  private cached: CachedResolution | undefined
  private inFlight: Promise<ResolvedIntegration> | undefined
  private generation = 0
  private lastPanelGateway: LastPanelGateway | undefined
  private environmentGateway: RailwayGatewayInterface | undefined

  constructor(private readonly dependencies: RailwayGatewayProviderDependencies) {}

  async resolve(): Promise<RailwayGatewayInterface | undefined> {
    if (this.hasEnvironmentToken()) return this.getEnvironmentGateway()
    return (await this.resolveCached()).gateway
  }

  async describe(): Promise<InfraIntegrationDescription> {
    if (this.hasEnvironmentToken()) return this.describeEnvironment()
    return (await this.resolveCached()).description
  }

  invalidate(): void {
    this.generation += 1
    this.cached = undefined
    this.inFlight = undefined
  }

  isCurrent(gateway: RailwayGatewayInterface): boolean {
    if (this.hasEnvironmentToken()) return gateway === this.environmentGateway
    return this.cached?.resolved.gateway === gateway
  }

  private hasEnvironmentToken(): boolean {
    return this.dependencies.config.environmentToken.length > 0
  }

  private getEnvironmentGateway(): RailwayGatewayInterface | undefined {
    const { config, buildGateway = createRailwayGateway } = this.dependencies
    this.environmentGateway ??= buildGateway({ token: config.environmentToken, workspaceId: config.workspaceId })
    return this.environmentGateway
  }

  private async describeEnvironment(): Promise<InfraIntegrationDescription> {
    const hasPanelRow = await this.hasPanelRow()
    return {
      source: 'environment',
      state: INFRA_INTEGRATION_STATE.CONFIGURED,
      workspaceId: this.dependencies.config.workspaceId,
      environmentTokenAlsoPresent: hasPanelRow,
    }
  }

  private async hasPanelRow(): Promise<boolean> {
    if (this.dependencies.config.env !== PRODUCTION) return false
    try {
      return (
        (await this.dependencies.integrationRepository.findByProvider(INFRA_INTEGRATION_PROVIDER.RAILWAY)) !== undefined
      )
    } catch {
      this.dependencies.logger.warn('infra.integration.panel_row_check_failed', {
        reason: INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE,
      })
      return false
    }
  }

  private resolveCached(): Promise<ResolvedIntegration> {
    if (this.cached && this.dependencies.now() < this.cached.expiresAt) return Promise.resolve(this.cached.resolved)
    if (this.inFlight) return this.inFlight
    const startedGeneration = this.generation
    const inFlight = this.loadPanelIntegration().then((resolved) => {
      this.commit({ resolved, startedGeneration })
      return resolved
    })
    this.inFlight = inFlight
    void inFlight.finally(() => {
      if (this.inFlight === inFlight) this.inFlight = undefined
    })
    return inFlight
  }

  // Resolução iniciada antes de um invalidate() não repovoa o cache com a credencial antiga.
  private commit(params: { readonly resolved: ResolvedIntegration; readonly startedGeneration: number }): void {
    if (params.startedGeneration !== this.generation) return
    const { resolved } = params
    const state = resolved.description.state
    const isTransientFailure = state === INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE
    const interval = this.dependencies.rereadIntervalMilliseconds ?? DEFAULT_REREAD_INTERVAL_MILLISECONDS
    this.cached = isTransientFailure ? undefined : { resolved, expiresAt: this.dependencies.now() + interval }
    // Queda do banco não prova que a credencial mudou: manter o gateway preserva o bloqueio de rate limit.
    if (isTransientFailure) return
    this.lastPanelGateway =
      resolved.gateway && resolved.fingerprint
        ? { fingerprint: resolved.fingerprint, gateway: resolved.gateway }
        : undefined
  }

  private buildOutcome(state: InfraIntegrationState, record?: InfraIntegrationRecord): ResolvedIntegration {
    const description: InfraIntegrationDescription = {
      source: state === INFRA_INTEGRATION_STATE.CONFIGURED ? 'panel' : 'none',
      state,
      environmentTokenAlsoPresent: false,
      ...(record && {
        workspaceId: record.workspaceId,
        tokenHint: record.tokenHint,
        updatedAt: record.updatedAt,
        ...(record.updatedByAgentId !== null && { updatedByAgentId: record.updatedByAgentId }),
      }),
    }
    return { gateway: undefined, description }
  }

  private async loadPanelIntegration(): Promise<ResolvedIntegration> {
    const { config, integrationRepository, logger } = this.dependencies
    const notConfigured = this.buildOutcome(INFRA_INTEGRATION_STATE.NOT_CONFIGURED)
    if (config.env !== PRODUCTION) return notConfigured
    if (config.workspaceId.length === 0 || config.environmentId.length === 0) return notConfigured
    try {
      const record = await integrationRepository.findByProvider(INFRA_INTEGRATION_PROVIDER.RAILWAY)
      return record ? this.resolveRecord(record) : notConfigured
    } catch {
      logger.error('infra.integration.store_unavailable', { reason: INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE })
      return this.buildOutcome(INFRA_INTEGRATION_STATE.STORE_UNAVAILABLE)
    }
  }

  private resolveRecord(record: InfraIntegrationRecord): ResolvedIntegration {
    const { config, logger } = this.dependencies
    const credential = resolvePanelCredential({
      record,
      workspaceId: config.workspaceId,
      encryptionKeyBase64: config.encryptionKeyBase64,
    })
    if (credential.token === undefined) {
      if (credential.unreadableReason)
        logger.error('infra.integration.secret_unreadable', { reason: credential.unreadableReason })
      return this.buildOutcome(credential.state, record)
    }
    const fingerprint = buildFingerprint(record)
    const gateway = this.reuseOrBuildGateway({ fingerprint, token: credential.token, workspaceId: record.workspaceId })
    return { ...this.buildOutcome(credential.state, record), gateway, fingerprint }
  }

  private reuseOrBuildGateway(params: {
    readonly fingerprint: string
    readonly token: string
    readonly workspaceId: string
  }): RailwayGatewayInterface | undefined {
    if (this.lastPanelGateway?.fingerprint === params.fingerprint) return this.lastPanelGateway.gateway
    const { buildGateway = createRailwayGateway } = this.dependencies
    return buildGateway({ token: params.token, workspaceId: params.workspaceId })
  }
}
