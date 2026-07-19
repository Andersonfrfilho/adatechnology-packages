/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { SecretEnvelopeProvider, SecretKeyRing } from './secret-envelope.types'

export function createSecretEnvelopeProvider(_keyRing: SecretKeyRing): SecretEnvelopeProvider {
  void _keyRing
  throw new Error('Secret envelope provider is not implemented')
}
