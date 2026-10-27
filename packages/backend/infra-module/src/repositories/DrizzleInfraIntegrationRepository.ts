/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq } from 'drizzle-orm'

import type {
  InfraIntegrationProvider,
  InfraIntegrationRecord,
  InfraIntegrationRepositoryInterface,
  IntegrationRowOperations,
  UpsertLockedIntegrationParams,
  UpsertLockedIntegrationResult,
} from '@adatechnology/infra-contracts'

import type { InfraDatabase } from '../database.types'
import { infraIntegrationSecrets } from '../schema/schema'
import { upsertIntegrationRow } from '../upsertIntegrationRow'

type Transaction = Parameters<Parameters<InfraDatabase['transaction']>[0]>[0]

async function selectForUpdate(
  transaction: Transaction,
  provider: InfraIntegrationProvider,
): Promise<InfraIntegrationRecord | undefined> {
  const [row] = await transaction
    .select()
    .from(infraIntegrationSecrets)
    .where(eq(infraIntegrationSecrets.provider, provider))
    .for('update')
    .limit(1)
  return row
}

function buildValues(params: UpsertLockedIntegrationParams) {
  return {
    provider: params.provider,
    workspaceId: params.workspaceId,
    ciphertext: params.ciphertext,
    keyId: params.keyId,
    tokenHint: params.tokenHint,
    updatedByAgentId: params.agentId ?? null,
  }
}

async function replaceRow(
  transaction: Transaction,
  params: UpsertLockedIntegrationParams,
): Promise<InfraIntegrationRecord | undefined> {
  const [row] = await transaction
    .update(infraIntegrationSecrets)
    .set({ ...buildValues(params), updatedAt: new Date() })
    .where(eq(infraIntegrationSecrets.provider, params.provider))
    .returning()
  return row
}

function buildRowOperations(transaction: Transaction, params: UpsertLockedIntegrationParams): IntegrationRowOperations {
  return {
    lockExisting: async () => (await selectForUpdate(transaction, params.provider)) !== undefined,
    insertIfAbsent: async () => {
      const [inserted] = await transaction
        .insert(infraIntegrationSecrets)
        .values(buildValues(params))
        .onConflictDoNothing({ target: infraIntegrationSecrets.provider })
        .returning()
      return inserted
    },
    replace: () => replaceRow(transaction, params),
  }
}

export class DrizzleInfraIntegrationRepository implements InfraIntegrationRepositoryInterface {
  constructor(private readonly db: InfraDatabase) {}

  async findByProvider(provider: InfraIntegrationProvider): Promise<InfraIntegrationRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(infraIntegrationSecrets)
      .where(eq(infraIntegrationSecrets.provider, provider))
      .limit(1)
    return row
  }

  async upsertLocked(params: UpsertLockedIntegrationParams): Promise<UpsertLockedIntegrationResult> {
    return this.db.transaction((transaction) => upsertIntegrationRow(buildRowOperations(transaction, params)))
  }

  async deleteLocked(provider: InfraIntegrationProvider): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      if (!(await selectForUpdate(transaction, provider))) return false
      await transaction.delete(infraIntegrationSecrets).where(eq(infraIntegrationSecrets.provider, provider))
      return true
    })
  }
}
