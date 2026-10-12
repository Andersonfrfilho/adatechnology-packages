/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraAccessStatus } from '@adatechnology/infra-contracts'
import type { InfraIntegrationView } from '@adatechnology/infra-contracts'
import type { InfraIntegrationDescription } from '@adatechnology/infra-contracts'

type BuildIntegrationViewParams = {
  readonly description: InfraIntegrationDescription
  readonly updatedByName?: string | undefined
  readonly access?: InfraAccessStatus | undefined
}

/** Campo a campo, nunca por espalhamento: o que nao esta aqui (token, cifrado, keyId, id do agente) nao sai. */
export function buildIntegrationView(params: BuildIntegrationViewParams): InfraIntegrationView {
  const { description, updatedByName, access } = params
  return {
    source: description.source,
    state: description.state,
    ...(description.tokenHint !== undefined ? { tokenHint: description.tokenHint } : {}),
    ...(description.workspaceId !== undefined ? { workspaceId: description.workspaceId } : {}),
    ...(description.updatedAt !== undefined ? { updatedAt: description.updatedAt } : {}),
    ...(updatedByName !== undefined ? { updatedByName } : {}),
    ...(access !== undefined ? { access } : {}),
    environmentTokenAlsoPresent: description.environmentTokenAlsoPresent,
  }
}
