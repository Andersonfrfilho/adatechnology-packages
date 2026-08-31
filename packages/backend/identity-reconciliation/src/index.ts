/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export { normalizeDocument, normalizeEmail, reconcileIdentities } from './identity-reconciliation.policy.js'

export { RECONCILIATION_MATCH, RECONCILIATION_STATUS } from './identity-reconciliation.types.js'

export {
  partitionByExistence,
  RECONCILIATION_VIEW_STATUS,
  summarizeReconciliation,
} from './reconciliation-summary.policy.js'

export type {
  ExistencePartition,
  ReconciliationSummary,
  ReconciliationViewStatus,
} from './reconciliation-summary.policy.js'

export type {
  IdentityDocument,
  IdentityEmails,
  LocalIdentityRecord,
  RealmIdentityRecord,
  ReconcileIdentitiesInput,
  ReconciliationEntry,
  ReconciliationMatch,
  ReconciliationStatus,
} from './identity-reconciliation.types.js'
