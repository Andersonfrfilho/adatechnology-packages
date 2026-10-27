/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_INTEGRATION_SOURCE = { ENVIRONMENT: 'environment', PANEL: 'panel', NONE: 'none' } as const
export type InfraIntegrationSource = (typeof INFRA_INTEGRATION_SOURCE)[keyof typeof INFRA_INTEGRATION_SOURCE]

export { INFRA_INTEGRATION_STATE } from '@adatechnology/infra-contracts'
export type { InfraIntegrationState } from '@adatechnology/infra-contracts'

export const INFRA_INTEGRATION_TONE = { OK: 'ok', NEUTRAL: 'neutral', WARNING: 'warning', ERROR: 'error' } as const
export type InfraIntegrationTone = (typeof INFRA_INTEGRATION_TONE)[keyof typeof INFRA_INTEGRATION_TONE]

/** Codigos de erro de dominio da integracao; os genericos (provedor, limite) seguem em `INFRA_ERROR_CODE`. */
export const INFRA_INTEGRATION_ERROR_CODE = {
  SECRET_KEY_MISSING: 'INFRA_SECRET_KEY_MISSING',
  PRODUCTION_ONLY: 'INFRA_INTEGRATION_PRODUCTION_ONLY',
  PASSWORD_INVALID: 'INFRA_INTEGRATION_PASSWORD_INVALID',
  LOCKED: 'INFRA_INTEGRATION_LOCKED',
  TOKEN_REJECTED: 'INFRA_INTEGRATION_TOKEN_REJECTED',
  TOKEN_TOO_BROAD: 'INFRA_INTEGRATION_TOKEN_TOO_BROAD',
  WORKSPACE_NOT_FOUND: 'INFRA_INTEGRATION_WORKSPACE_NOT_FOUND',
  ENVIRONMENT_MANAGED: 'INFRA_INTEGRATION_ENVIRONMENT_MANAGED',
} as const

export const INTEGRATION_TOKEN_MIN_LENGTH = 16
export const INTEGRATION_TOKEN_MAX_LENGTH = 128
export const INTEGRATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/

export const INTEGRATION_TOKEN_ISSUE = {
  EMPTY: 'empty',
  TOO_SHORT: 'tooShort',
  TOO_LONG: 'tooLong',
  INVALID_CHARACTERS: 'invalidCharacters',
} as const
export type IntegrationTokenIssue = (typeof INTEGRATION_TOKEN_ISSUE)[keyof typeof INTEGRATION_TOKEN_ISSUE]

export const INFRA_INTEGRATION_STALE_TIME_MS = 10_000
export const INTEGRATION_VERIFY_COOLDOWN_MS = 30_000

// Nome neutro de proposito: "token", "password" ou "api-key" atraem o preenchimento automatico.
export const INTEGRATION_TOKEN_FIELD_NAME = 'provider-credential'
export const INTEGRATION_PASSWORD_FIELD_NAME = 'panel-confirmation'

/** Mascara so visual: `type="password"` seria oferecido a gerenciadores de senha (RF13). */
export const INTEGRATION_TOKEN_MASK_CLASS = '[-webkit-text-security:disc]'
