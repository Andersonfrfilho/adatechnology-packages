/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export { SecretEnvelopeConfigurationError, SecretEnvelopeError } from './secret-envelope.error'
export { createSecretEnvelopeProvider } from './secret-envelope.factory'
export { SECRET_ENVELOPE_ERROR_CODES } from './secret-envelope.types'
export type {
  DecryptSecretInput,
  EncryptSecretInput,
  SecretEnvelopeErrorCode,
  SecretEnvelopeProvider,
  SecretEnvelopeV1,
  SecretKeyRing,
} from './secret-envelope.types'
