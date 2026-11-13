/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { FAKE_NOW } from './fakeNow.constant'
import type { InfraIntegrationProvider } from '@adatechnology/infra-contracts'
import type {
  InfraIntegrationRecord,
  UpsertLockedIntegrationParams,
  UpsertLockedIntegrationResult,
} from '@adatechnology/infra-contracts'
import type { InfraIntegrationRepositoryInterface } from '@adatechnology/infra-contracts'

export class FakeIntegrationRepository implements InfraIntegrationRepositoryInterface {
  readonly records = new Map<string, InfraIntegrationRecord>()

  seed(record: InfraIntegrationRecord): void {
    this.records.set(record.provider, record)
  }

  async findByProvider(provider: InfraIntegrationProvider): Promise<InfraIntegrationRecord | undefined> {
    return this.records.get(provider)
  }

  async upsertLocked(params: UpsertLockedIntegrationParams): Promise<UpsertLockedIntegrationResult> {
    const existing = this.records.get(params.provider)
    const record: InfraIntegrationRecord = {
      id: existing?.id ?? `integration-${this.records.size + 1}`,
      provider: params.provider,
      workspaceId: params.workspaceId,
      ciphertext: params.ciphertext,
      keyId: params.keyId,
      tokenHint: params.tokenHint,
      updatedByAgentId: params.agentId ?? null,
      createdAt: existing?.createdAt ?? FAKE_NOW,
      updatedAt: FAKE_NOW,
    }
    this.records.set(params.provider, record)
    return { record, wasReplacement: existing !== undefined }
  }

  async deleteLocked(provider: InfraIntegrationProvider): Promise<boolean> {
    return this.records.delete(provider)
  }
}
