/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { InfraProviderRateLimitedError, InfraProviderRejectedError } from '@adatechnology/infra-contracts'
import { PROBE_WORKSPACE_OPERATION, PROBE_WORKSPACE_OUTCOME } from '@adatechnology/infra-contracts'
import {
  PROBE_ACCOUNT_SCOPE_QUERY,
  PROBE_WORKSPACE_QUERY,
  probeAccountScopeResponseSchema,
  probeWorkspaceResponseSchema,
} from './drivers/railway/probeWorkspace.documents'
import { RailwayGraphqlClient } from './drivers/railway/RailwayGraphqlClient'
import type { ProbeWorkspaceParams, ProbeWorkspaceResult } from '@adatechnology/infra-contracts'

const OUTCOME = PROBE_WORKSPACE_OUTCOME

/**
 * Testa um token candidato num cliente novo (com gate de rate limit proprio): um 429 aqui nunca bloqueia o gateway em uso.
 * Sem poder checar o escopo, o token nao e aceito (fail closed).
 */
export async function probeWorkspace(params: ProbeWorkspaceParams): Promise<ProbeWorkspaceResult> {
  const { token, workspaceId, fetchImplementation, now } = params
  const client = new RailwayGraphqlClient({
    token,
    fetchImplementation: fetchImplementation ?? fetch,
    now: now ?? Date.now,
  })

  try {
    const workspace = await client.execute({
      operationName: PROBE_WORKSPACE_OPERATION.WORKSPACE,
      query: PROBE_WORKSPACE_QUERY,
      variables: { workspaceId },
      schema: probeWorkspaceResponseSchema,
    })
    if (workspace.workspace?.id !== workspaceId) return { outcome: OUTCOME.WORKSPACE_NOT_FOUND }
  } catch (error) {
    return classifyWorkspaceFailure(error)
  }

  return probeAccountScope(client)
}

async function probeAccountScope(client: RailwayGraphqlClient): Promise<ProbeWorkspaceResult> {
  try {
    const account = await client.execute({
      operationName: PROBE_WORKSPACE_OPERATION.ACCOUNT_SCOPE,
      query: PROBE_ACCOUNT_SCOPE_QUERY,
      variables: {},
      schema: probeAccountScopeResponseSchema,
    })
    return account.me?.id === undefined ? { outcome: OUTCOME.OK } : { outcome: OUTCOME.TOO_BROAD }
  } catch (error) {
    // Token de workspace nao enxerga `me`: a recusa e o resultado esperado.
    if (error instanceof InfraProviderRejectedError && error.isAuthFailure) return { outcome: OUTCOME.OK }
    return classifyCommonFailure(error)
  }
}

function classifyWorkspaceFailure(error: unknown): ProbeWorkspaceResult {
  if (error instanceof InfraProviderRejectedError && error.isAuthFailure) return { outcome: OUTCOME.TOKEN_REJECTED }
  if (error instanceof InfraProviderRejectedError && error.isNotFound) return { outcome: OUTCOME.WORKSPACE_NOT_FOUND }
  return classifyCommonFailure(error)
}

function classifyCommonFailure(error: unknown): ProbeWorkspaceResult {
  if (error instanceof InfraProviderRateLimitedError) {
    const retryAfterSeconds = error.context.retryAfterSeconds
    // Sem prazo valido o header e omitido: `Retry-After: 0` mandaria o cliente repetir na hora.
    const hasDeadline = typeof retryAfterSeconds === 'number' && retryAfterSeconds >= 1
    return { outcome: OUTCOME.RATE_LIMITED, ...(hasDeadline ? { retryAfterSeconds } : {}) }
  }
  return { outcome: OUTCOME.UNAVAILABLE }
}
