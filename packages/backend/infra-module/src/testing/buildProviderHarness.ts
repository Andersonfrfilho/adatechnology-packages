/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { DefaultInfraGatewayProvider } from '../InfraGatewayProvider'
import { buildFakeGateway } from './buildFakeGateway'
import { FAKE_NOW } from './fakeNow.constant'
import { FakeIntegrationRepository } from './FakeIntegrationRepository'
import { sealSecret } from '../infraSecretCipher'
import { loadInfraSecretKey } from '../infraSecretKey'
import type { InfraIntegrationProvider } from '@adatechnology/infra-contracts'
import type { InfraIntegrationRecord } from '@adatechnology/infra-contracts'
import type { CreateInfraGatewayParams } from '@adatechnology/infra-contracts'
import type { InfraGatewayInterface } from '@adatechnology/infra-contracts'
import type { InfraGatewayProviderConfig } from '@adatechnology/infra-contracts'

export const DECOY_TOKEN = 'ISCA-TOKEN-0123456789'
export const WORKSPACE_ID = 'workspace-1'
export const KEY_BASE64 = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 3 + 1)).toString('base64')
export const OTHER_KEY_BASE64 = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 8 + 1)).toString('base64')
export const REREAD_MILLISECONDS = 30_000

export class ControlledRepository extends FakeIntegrationRepository {
  reads = 0
  failWith: Error | undefined
  /** Uma promessa por leitura, na ordem; a leitura captura o estado ANTES de esperar. */
  readonly gates: Promise<void>[] = []

  override async findByProvider(provider: InfraIntegrationProvider): Promise<InfraIntegrationRecord | undefined> {
    this.reads += 1
    if (this.failWith) throw this.failWith
    const snapshot = this.records.get(provider)
    const gate = this.gates.shift()
    if (gate) await gate
    return snapshot
  }
}

export function buildRecord(overrides: Partial<InfraIntegrationRecord> = {}): InfraIntegrationRecord {
  const workspaceId = overrides.workspaceId ?? WORKSPACE_ID
  const key = loadInfraSecretKey(KEY_BASE64)
  return {
    id: 'integration-1',
    provider: 'railway',
    workspaceId,
    ciphertext: sealSecret({ plaintext: DECOY_TOKEN, key, provider: 'railway', workspaceId }),
    keyId: key.keyId,
    tokenHint: '6789',
    updatedByAgentId: null,
    createdAt: FAKE_NOW,
    updatedAt: FAKE_NOW,
    ...overrides,
  }
}

export type ProviderHarnessOptions = { readonly config?: Partial<InfraGatewayProviderConfig> }

export function buildProviderHarness(options: ProviderHarnessOptions = {}) {
  const repository = new ControlledRepository()
  const logs: string[] = []
  const warnings: string[] = []
  const builtWith: CreateInfraGatewayParams[] = []
  const clock = { now: 0 }
  const config: InfraGatewayProviderConfig = {
    env: 'production',
    environmentToken: '',
    workspaceId: WORKSPACE_ID,
    environmentId: 'environment-1',
    encryptionKeyBase64: KEY_BASE64,
    ...options.config,
  }
  const provider = new DefaultInfraGatewayProvider({
    config,
    integrationRepository: repository,
    buildGateway: (params): InfraGatewayInterface => {
      builtWith.push(params)
      return buildFakeGateway({ projects: [] })
    },
    now: () => clock.now,
    logger: {
      info: (message, meta) => void logs.push(`${message} ${JSON.stringify(meta)}`),
      error: (message, meta) => void logs.push(`${message} ${JSON.stringify(meta)}`),
      warn: (message, meta) => void warnings.push(`${message} ${JSON.stringify(meta)}`),
    },
  })
  return { provider, repository, logs, warnings, builtWith, clock }
}
