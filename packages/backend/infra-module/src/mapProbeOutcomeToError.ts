/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraProviderRateLimitedError, InfraProviderRequestFailedError } from '@adatechnology/infra-contracts'
import { INFRA_INTEGRATION_AUDIT_REASON as REASON } from '@adatechnology/infra-contracts'
import {
  InfraIntegrationTokenRejectedError,
  InfraIntegrationTokenTooBroadError,
  InfraIntegrationWorkspaceNotFoundError,
} from '@adatechnology/infra-contracts'
import { PROBE_WORKSPACE_OUTCOME as OUTCOME } from '@adatechnology/infra-contracts'
import type { ProbeRefusal } from '@adatechnology/infra-contracts'
import type { ProbeWorkspaceResult } from '@adatechnology/infra-contracts'

function toValidRetryAfter(retryAfterSeconds: number | undefined): number | undefined {
  return retryAfterSeconds !== undefined && retryAfterSeconds >= 1 ? retryAfterSeconds : undefined
}

/** `undefined` = o token foi aceito; qualquer outro resultado e uma recusa com motivo de auditoria. */
export function mapProbeOutcomeToError(result: ProbeWorkspaceResult): ProbeRefusal | undefined {
  switch (result.outcome) {
    case OUTCOME.OK:
      return undefined
    case OUTCOME.TOKEN_REJECTED:
      return { reason: REASON.TOKEN_REJECTED, error: new InfraIntegrationTokenRejectedError() }
    case OUTCOME.WORKSPACE_NOT_FOUND:
      return { reason: REASON.WORKSPACE_NOT_FOUND, error: new InfraIntegrationWorkspaceNotFoundError() }
    case OUTCOME.TOO_BROAD:
      return { reason: REASON.TOKEN_TOO_BROAD, error: new InfraIntegrationTokenTooBroadError() }
    case OUTCOME.RATE_LIMITED:
      return {
        reason: REASON.RATE_LIMITED,
        error: new InfraProviderRateLimitedError(toValidRetryAfter(result.retryAfterSeconds)),
      }
    case OUTCOME.UNAVAILABLE:
      return { reason: REASON.UNAVAILABLE, error: new InfraProviderRequestFailedError('probeWorkspace') }
  }
}
