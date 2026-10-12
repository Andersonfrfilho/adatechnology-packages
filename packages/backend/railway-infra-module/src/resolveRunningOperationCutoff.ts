/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INFRA_OPERATION_LOCK_GRACE_SECONDS } from '@adatechnology/railway-infra-contracts'

const MILLISECONDS_PER_SECOND = 1000

type ResolveRunningOperationCutoffParams = {
  readonly now: Date
  readonly databaseWaitSeconds: number
}

/** Operação `running` iniciada antes disto já perdeu a trava (TTL vencido): o processo dela morreu. */
export function resolveRunningOperationCutoff(params: ResolveRunningOperationCutoffParams): Date {
  const lockTtlSeconds = params.databaseWaitSeconds + INFRA_OPERATION_LOCK_GRACE_SECONDS
  return new Date(params.now.getTime() - lockTtlSeconds * MILLISECONDS_PER_SECOND)
}
