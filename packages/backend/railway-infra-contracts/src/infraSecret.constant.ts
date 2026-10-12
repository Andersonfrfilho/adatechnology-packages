/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export const INFRA_SECRET_UNREADABLE_REASON = {
  MALFORMED: 'malformed',
  KEY_MISMATCH: 'key_mismatch',
  AUTHENTICATION_FAILED: 'authentication_failed',
} as const

export const INFRA_SECRET_FORMAT_VERSION = 'v1'
export const INFRA_SECRET_AAD_PREFIX = 'ada.infra.railway-token'
export const INFRA_SECRET_ALGORITHM = 'aes-256-gcm'
export const INFRA_SECRET_KEY_BYTES = 32
export const INFRA_SECRET_KEY_MIN_DISTINCT_BYTES = 16
export const INFRA_SECRET_IV_BYTES = 12
export const INFRA_SECRET_TAG_BYTES = 16
export const INFRA_SECRET_KEY_ID_BYTES = 8
export const INFRA_SECRET_PART_COUNT = 5

export type InfraSecretUnreadableReason =
  (typeof INFRA_SECRET_UNREADABLE_REASON)[keyof typeof INFRA_SECRET_UNREADABLE_REASON]
