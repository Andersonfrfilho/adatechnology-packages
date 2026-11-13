/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import {
  createSecretEnvelopeProvider,
  SecretEnvelopeConfigurationError,
  SecretEnvelopeError,
  type SecretKeyRing,
  type SecretEnvelopeV1,
} from '../src'
import {
  AAD_SENTINEL,
  captureFailure,
  createKey,
  createKeyRing,
  encode,
  toBase64Url,
} from './secret-envelope-test.fixtures'

describe('secret envelope validation contract', () => {
  test('rejects empty, missing, malformed, and incorrectly sized keyrings', () => {
    const invalidKeyRings: readonly SecretKeyRing[] = [
      createKeyRing({ activeKeyId: 'missing', keys: { present: createKey() } }),
      createKeyRing({ keys: {} }),
      createKeyRing({ keys: { 'key-v1': new Uint8Array(31) } }),
      undefined as unknown as SecretKeyRing,
      {
        activeKeyId: 'key-v1',
        keys: { 'key-v1': 'not-key-bytes' },
      } as unknown as SecretKeyRing,
    ]

    for (const keyRing of invalidKeyRings) {
      expect(() => createSecretEnvelopeProvider(keyRing)).toThrow(SecretEnvelopeConfigurationError)
    }
  })

  test('strictly rejects unknown versions, algorithms, and non-canonical base64url', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const validShape: SecretEnvelopeV1 = {
      version: 1,
      algorithm: 'A256GCM',
      keyId: 'key-v1',
      nonce: toBase64Url(new Uint8Array(12)),
      ciphertext: toBase64Url(new Uint8Array(16)),
    }
    const invalidEnvelopes: readonly unknown[] = [
      { ...validShape, version: 2 },
      { ...validShape, algorithm: 'AES-GCM' },
      { ...validShape, keyId: '' },
      { ...validShape, unexpected: true },
      { ...validShape, nonce: 'AAAAAAAAAAAAAAAA==' },
      { ...validShape, nonce: 'AAAAAAAAAAAAAAA+' },
      { ...validShape, ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA==' },
    ]

    for (const envelope of invalidEnvelopes) {
      const error = await captureFailure(() =>
        provider.decrypt({
          envelope: envelope as SecretEnvelopeV1,
          additionalAuthenticatedData,
        }),
      )
      expect(error).toBeInstanceOf(SecretEnvelopeError)
      expect((error as SecretEnvelopeError).code).toBe('INVALID_ENVELOPE')
    }
  })

  test('rejects nonce and ciphertext sizes outside the version-one envelope', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const invalidEnvelopes: readonly SecretEnvelopeV1[] = [
      {
        version: 1,
        algorithm: 'A256GCM',
        keyId: 'key-v1',
        nonce: toBase64Url(new Uint8Array(11)),
        ciphertext: toBase64Url(new Uint8Array(16)),
      },
      {
        version: 1,
        algorithm: 'A256GCM',
        keyId: 'key-v1',
        nonce: toBase64Url(new Uint8Array(12)),
        ciphertext: toBase64Url(new Uint8Array(15)),
      },
      {
        version: 1,
        algorithm: 'A256GCM',
        keyId: 'key-v1',
        nonce: toBase64Url(new Uint8Array(12)),
        ciphertext: toBase64Url(new Uint8Array(1_048_593)),
      },
    ]

    for (const envelope of invalidEnvelopes) {
      const error = await captureFailure(() => provider.decrypt({ envelope, additionalAuthenticatedData }))
      expect(error).toBeInstanceOf(SecretEnvelopeError)
      expect((error as SecretEnvelopeError).code).toBe('INVALID_ENVELOPE')
    }
  })

  test('rejects plaintext above 1 MiB before encryption', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const error = await captureFailure(() =>
      provider.encrypt({
        plaintext: new Uint8Array(1_048_577),
        additionalAuthenticatedData: encode(AAD_SENTINEL),
      }),
    )

    expect(error).toBeInstanceOf(SecretEnvelopeError)
    expect((error as SecretEnvelopeError).code).toBe('PLAINTEXT_TOO_LARGE')
  })

  test('rejects empty AAD for both encryption and decryption', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await provider.encrypt({
      plaintext: encode('secret'),
      additionalAuthenticatedData,
    })
    const failures = await Promise.all([
      captureFailure(() =>
        provider.encrypt({
          plaintext: encode('secret'),
          additionalAuthenticatedData: new Uint8Array(),
        }),
      ),
      captureFailure(() =>
        provider.decrypt({
          envelope,
          additionalAuthenticatedData: new Uint8Array(),
        }),
      ),
    ])

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(SecretEnvelopeError)
      expect((failure as SecretEnvelopeError).code).toBe('INVALID_INPUT')
    }
  })
})
