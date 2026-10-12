/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraIntegrationRecord } from './infraIntegration.types'

/** Passos sobre a linha de integracao, todos dentro da mesma transacao. */
export type IntegrationRowOperations = {
  /** `true` quando a linha existe e ficou travada para esta transacao. */
  readonly lockExisting: () => Promise<boolean>
  /** `undefined` quando um INSERT concorrente ja ocupou a chave unica. */
  readonly insertIfAbsent: () => Promise<InfraIntegrationRecord | undefined>
  /** `undefined` quando a linha sumiu (DELETE concorrente) antes da troca. */
  readonly replace: () => Promise<InfraIntegrationRecord | undefined>
}
