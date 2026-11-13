/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { SecretEnvelopeErrorCode } from './secret-envelope.types'

export class SecretEnvelopeError extends Error {
  readonly code: SecretEnvelopeErrorCode

  constructor(code: SecretEnvelopeErrorCode) {
    super('Secret envelope operation failed')
    this.name = 'SecretEnvelopeError'
    this.code = code
  }
}

export class SecretEnvelopeConfigurationError extends SecretEnvelopeError {
  constructor() {
    super('INVALID_CONFIGURATION')
    this.name = 'SecretEnvelopeConfigurationError'
  }
}
