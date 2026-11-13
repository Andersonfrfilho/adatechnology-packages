/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

// Enum fechado: texto livre na auditoria poderia carregar o token ou a senha por engano.
export const INFRA_INTEGRATION_AUDIT_REASON = {
  CONFIGURED: 'configured',
  REPLACED: 'replaced',
  REMOVED: 'removed',
  VERIFIED_OK: 'verified_ok',
  VERIFIED_FAILED: 'verified_failed',
  PASSWORD_INVALID: 'password_invalid',
  PRODUCTION_ONLY: 'production_only',
  KEY_MISSING: 'key_missing',
  TOKEN_REJECTED: 'token_rejected',
  TOKEN_TOO_BROAD: 'token_too_broad',
  WORKSPACE_NOT_FOUND: 'workspace_not_found',
  ENVIRONMENT_MANAGED: 'environment_managed',
  LOCKED: 'locked',
  UNAVAILABLE: 'unavailable',
  RATE_LIMITED: 'rate_limited',
  NOT_ADMIN: 'not_admin',
  NOT_CONFIGURED: 'not_configured',
} as const

export const INFRA_INTEGRATION_AUDIT_SOURCE = {
  PANEL: 'panel',
  ENVIRONMENT: 'environment',
} as const
