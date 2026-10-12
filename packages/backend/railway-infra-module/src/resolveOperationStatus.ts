/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  INFRA_OPERATION_STATUS,
  INFRA_SERVICE_OUTCOME,
  type InfraOperationStatus,
} from '@adatechnology/railway-infra-contracts'
import type { InfraServiceResult, ResolveOperationStatusParams } from '@adatechnology/railway-infra-contracts'

export type ServiceOutcomeCounts = { readonly ok: number; readonly failed: number; readonly skipped: number }

export function countServiceOutcomes(serviceResults: readonly InfraServiceResult[]): ServiceOutcomeCounts {
  const countOf = (outcome: string): number => serviceResults.filter((result) => result.outcome === outcome).length
  return {
    ok: countOf(INFRA_SERVICE_OUTCOME.OK),
    failed: countOf(INFRA_SERVICE_OUTCOME.FAILED),
    skipped: countOf(INFRA_SERVICE_OUTCOME.SKIPPED),
  }
}

export function resolveOperationStatus(params: ResolveOperationStatusParams): InfraOperationStatus {
  const { ok, failed } = countServiceOutcomes(params.serviceResults)
  if (failed === 0) return INFRA_OPERATION_STATUS.SUCCEEDED
  return ok > 0 ? INFRA_OPERATION_STATUS.PARTIALLY_FAILED : INFRA_OPERATION_STATUS.FAILED
}
