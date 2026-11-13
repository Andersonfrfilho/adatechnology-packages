/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { VerifyAdminPasswordParams, VerifyAdminPasswordResult } from '@adatechnology/infra-contracts'
import type { InfraAuditEntry } from '@adatechnology/infra-contracts'
import { buildFakeGateway } from './buildFakeGateway'
import { FakeInfraCache } from './FakeInfraCache'
import { FakeIntegrationRepository } from './FakeIntegrationRepository'
import { KEY_BASE64, WORKSPACE_ID } from './buildProviderHarness'
import { PROBE_WORKSPACE_OUTCOME } from '@adatechnology/infra-contracts'
import type { InfraAccessStatus } from '@adatechnology/infra-contracts'
import type { UpsertLockedIntegrationParams, UpsertLockedIntegrationResult } from '@adatechnology/infra-contracts'
import type { ProbeWorkspaceParams, ProbeWorkspaceResult } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type {
  InfraIntegrationDescription,
  InfraGatewayProvider,
  InfraGatewayProviderConfig,
} from '@adatechnology/infra-contracts'

export const INTEGRATION_AGENT_ID = '33333333-3333-4333-8333-333333333333'
export const INTEGRATION_IP_ADDRESS = '203.0.113.9'
export const INTEGRATION_PASSWORD = 'senha-inventada-123'

export class SpyIntegrationRepository extends FakeIntegrationRepository {
  upsertCalls = 0
  deleteCalls = 0
  readonly writtenCiphertexts: string[] = []

  constructor(private readonly events: string[]) {
    super()
  }

  override async upsertLocked(params: UpsertLockedIntegrationParams): Promise<UpsertLockedIntegrationResult> {
    this.upsertCalls += 1
    this.events.push('write')
    this.writtenCiphertexts.push(params.ciphertext)
    return super.upsertLocked(params)
  }

  override async deleteLocked(provider: Parameters<FakeIntegrationRepository['deleteLocked']>[0]): Promise<boolean> {
    this.deleteCalls += 1
    return super.deleteLocked(provider)
  }
}

export class FakeGatewayProvider implements InfraGatewayProvider {
  constructor(private readonly events: string[]) {}

  invalidations = 0
  resolveCalls = 0
  gateway: InfraGatewayInterface | undefined
  /** Quando definido, só este gateway conta como atual (simula troca de token em voo). */
  currentGateway: InfraGatewayInterface | undefined
  description: InfraIntegrationDescription = {
    source: 'none',
    state: 'not_configured',
    environmentTokenAlsoPresent: false,
  }

  async resolve(): Promise<InfraGatewayInterface | undefined> {
    this.resolveCalls += 1
    return this.gateway
  }

  async describe(): Promise<InfraIntegrationDescription> {
    return this.description
  }

  invalidate(): void {
    this.events.push('invalidate')
    this.invalidations += 1
  }

  isCurrent(gateway: InfraGatewayInterface): boolean {
    return this.currentGateway === undefined || gateway === this.currentGateway
  }
}

export class FlakyDeleteCache extends FakeInfraCache {
  failDelete = false

  override async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('redis down')
    return super.delete(key)
  }
}

export function buildCountingGateway(access: InfraAccessStatus): {
  readonly gateway: InfraGatewayInterface
  readonly counter: { verifyCalls: number }
} {
  const gateway = buildFakeGateway({ projects: [] })
  const counter = { verifyCalls: 0 }
  gateway.verifyAccess = async (): Promise<InfraAccessStatus> => {
    counter.verifyCalls += 1
    return access
  }
  return { gateway, counter }
}

export type IntegrationHarnessOptions = { readonly config?: Partial<InfraGatewayProviderConfig> }

export function buildIntegrationHarness(options: IntegrationHarnessOptions = {}) {
  const events: string[] = []
  const repository = new SpyIntegrationRepository(events)
  const provider = new FakeGatewayProvider(events)
  const cache = new FlakyDeleteCache()
  const auditCalls: InfraAuditEntry[] = []
  const logs: string[] = []
  const passwordCalls: VerifyAdminPasswordParams[] = []
  const probeCalls: ProbeWorkspaceParams[] = []
  const state = {
    passwordResult: { outcome: 'confirmed' } as VerifyAdminPasswordResult,
    probeResult: { outcome: PROBE_WORKSPACE_OUTCOME.OK } as ProbeWorkspaceResult,
    failAudit: false,
  }
  const config: InfraGatewayProviderConfig = {
    env: 'production',
    environmentToken: '',
    workspaceId: WORKSPACE_ID,
    environmentId: 'environment-1',
    encryptionKeyBase64: KEY_BASE64,
    ...options.config,
  }
  const dependencies = {
    config,
    integrationRepository: repository,
    gatewayProvider: provider,
    cache,
    verifyAgentPassword: {
      execute: async (params: VerifyAdminPasswordParams): Promise<VerifyAdminPasswordResult> => {
        events.push('password')
        passwordCalls.push(params)
        return state.passwordResult
      },
    },
    probeWorkspace: async (params: ProbeWorkspaceParams): Promise<ProbeWorkspaceResult> => {
      events.push('probe')
      probeCalls.push(params)
      return state.probeResult
    },
    recordAudit: {
      execute: async (entry: InfraAuditEntry): Promise<void> => {
        if (state.failAudit) throw new Error('audit down')
        auditCalls.push(entry)
      },
    },
    logger: {
      info: (message: string, meta: Readonly<Record<string, unknown>>) =>
        void logs.push(`${message} ${JSON.stringify(meta)}`),
      error: (message: string, meta: Readonly<Record<string, unknown>>) =>
        void logs.push(`${message} ${JSON.stringify(meta)}`),
    },
  }
  return { dependencies, repository, provider, cache, auditCalls, logs, passwordCalls, probeCalls, events, state }
}

export type IntegrationHarness = ReturnType<typeof buildIntegrationHarness>
