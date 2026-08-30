/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export { normalizeDocument, normalizeEmail, reconcileIdentities } from './identity-reconciliation.policy.js'

export { RECONCILIATION_MATCH, RECONCILIATION_STATUS } from './identity-reconciliation.types.js'

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
