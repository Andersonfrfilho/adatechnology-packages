/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
export const SECRET_ENVELOPE_ERROR_CODES = [
  'INVALID_CONFIGURATION',
  'INVALID_INPUT',
  'INVALID_ENVELOPE',
  'UNKNOWN_KEY',
  'PLAINTEXT_TOO_LARGE',
  'DECRYPTION_FAILED',
] as const

export type SecretEnvelopeErrorCode = (typeof SECRET_ENVELOPE_ERROR_CODES)[number]

export type SecretEnvelopeV1 = Readonly<{
  version: 1
  algorithm: 'A256GCM'
  keyId: string
  nonce: string
  ciphertext: string
}>

export type SecretKeyRing = Readonly<{
  activeKeyId: string
  keys: Readonly<Record<string, Uint8Array>>
}>

export type EncryptSecretInput = Readonly<{
  plaintext: Uint8Array
  additionalAuthenticatedData: Uint8Array
}>

export type DecryptSecretInput = Readonly<{
  envelope: SecretEnvelopeV1
  additionalAuthenticatedData: Uint8Array
}>

export type SecretEnvelopeProvider = Readonly<{
  encrypt: (input: EncryptSecretInput) => Promise<SecretEnvelopeV1>
  decrypt: (input: DecryptSecretInput) => Promise<Uint8Array>
}>
