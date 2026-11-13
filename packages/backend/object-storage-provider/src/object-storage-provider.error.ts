/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const OBJECT_STORAGE_ERROR_CODES = {
  invalidConfiguration: 'OBJECT_STORAGE_INVALID_CONFIGURATION',
  invalidBucket: 'OBJECT_STORAGE_INVALID_BUCKET',
  invalidKey: 'OBJECT_STORAGE_INVALID_KEY',
  contentLengthMismatch: 'OBJECT_STORAGE_CONTENT_LENGTH_MISMATCH',
  objectTooLarge: 'OBJECT_STORAGE_OBJECT_TOO_LARGE',
  invalidContentType: 'OBJECT_STORAGE_INVALID_CONTENT_TYPE',
  sha256Mismatch: 'OBJECT_STORAGE_SHA256_MISMATCH',
  objectConflict: 'OBJECT_STORAGE_OBJECT_CONFLICT',
  signedUrlExpirationInvalid: 'OBJECT_STORAGE_SIGNED_URL_EXPIRATION_INVALID',
  providerClosed: 'OBJECT_STORAGE_PROVIDER_CLOSED',
  unavailable: 'OBJECT_STORAGE_UNAVAILABLE',
  notImplemented: 'OBJECT_STORAGE_NOT_IMPLEMENTED',
} as const

export type ObjectStorageErrorCode = (typeof OBJECT_STORAGE_ERROR_CODES)[keyof typeof OBJECT_STORAGE_ERROR_CODES]

export class ObjectStorageError extends Error {
  readonly name = 'ObjectStorageError'

  constructor(
    readonly code: ObjectStorageErrorCode,
    message: string,
  ) {
    super(message)
  }
}
