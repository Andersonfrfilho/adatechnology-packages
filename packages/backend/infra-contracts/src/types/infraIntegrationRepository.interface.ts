/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InfraIntegrationProvider } from '../infra.constant'
import type {
  InfraIntegrationRecord,
  UpsertLockedIntegrationParams,
  UpsertLockedIntegrationResult,
} from './infraIntegration.types'

export interface InfraIntegrationRepositoryInterface {
  findByProvider(provider: InfraIntegrationProvider): Promise<InfraIntegrationRecord | undefined>
  /** Transacao com FOR UPDATE; `wasReplacement` = a linha ja existia antes desta chamada. */
  upsertLocked(params: UpsertLockedIntegrationParams): Promise<UpsertLockedIntegrationResult>
  /** Devolve true se havia linha para remover. */
  deleteLocked(provider: InfraIntegrationProvider): Promise<boolean>
}
