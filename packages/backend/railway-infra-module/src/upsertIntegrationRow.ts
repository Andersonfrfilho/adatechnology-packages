/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraIntegrationConcurrentChangeError } from '@adatechnology/railway-infra-contracts'
import type { UpsertLockedIntegrationResult } from '@adatechnology/railway-infra-contracts'
import type { IntegrationRowOperations } from '@adatechnology/railway-infra-contracts'

// Uma segunda volta cobre INSERT e DELETE concorrentes; perder as duas corridas vira 409, nunca 500.
const MAX_ATTEMPTS = 2

export async function upsertIntegrationRow(
  operations: IntegrationRowOperations,
): Promise<UpsertLockedIntegrationResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (await operations.lockExisting()) {
      const replaced = await operations.replace()
      if (replaced) return { record: replaced, wasReplacement: true }
      continue
    }
    const inserted = await operations.insertIfAbsent()
    if (inserted) return { record: inserted, wasReplacement: false }
  }
  throw new InfraIntegrationConcurrentChangeError()
}
