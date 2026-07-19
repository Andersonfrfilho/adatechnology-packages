/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { createSecretEnvelopeProvider, SecretEnvelopeError, type SecretEnvelopeV1 } from '../src'
import {
  AAD_SENTINEL,
  alterBase64Url,
  alterLastByteBase64Url,
  captureFailure,
  createKey,
  createKeyRing,
  encode,
  frameFields,
  PLAINTEXT_SENTINEL,
} from './secret-envelope-test.fixtures'

describe('secret envelope integrity contract', () => {
  test('binds ciphertext to length-prefixed AAD without concatenation collisions', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const firstFrame = frameFields([encode('ab'), encode('c')])
    const collidingConcatenationFrame = frameFields([encode('a'), encode('bc')])
    const envelope = await provider.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData: firstFrame,
    })

    const error = await captureFailure(() =>
      provider.decrypt({
        envelope,
        additionalAuthenticatedData: collidingConcatenationFrame,
      }),
    )

    expect(error).toBeInstanceOf(SecretEnvelopeError)
  })

  test('rejects altered AAD, nonce, ciphertext, and authentication tag', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await provider.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData,
    })
    const alteredEnvelopes: readonly SecretEnvelopeV1[] = [
      { ...envelope, nonce: alterBase64Url(envelope.nonce) },
      { ...envelope, ciphertext: alterBase64Url(envelope.ciphertext) },
      { ...envelope, ciphertext: alterLastByteBase64Url(envelope.ciphertext) },
    ]

    const failures = await Promise.all([
      captureFailure(() =>
        provider.decrypt({
          envelope,
          additionalAuthenticatedData: encode(`${AAD_SENTINEL}:altered`),
        }),
      ),
      ...alteredEnvelopes.map((alteredEnvelope) =>
        captureFailure(() =>
          provider.decrypt({
            envelope: alteredEnvelope,
            additionalAuthenticatedData,
          }),
        ),
      ),
    ])

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(SecretEnvelopeError)
    }
  })

  test('decrypts an old envelope after active-key rotation', async () => {
    const oldKey = createKey(31)
    const writer = createSecretEnvelopeProvider(
      createKeyRing({
        activeKeyId: 'key-old',
        keys: { 'key-old': oldKey },
      }),
    )
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await writer.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData,
    })
    const rotatedReader = createSecretEnvelopeProvider(
      createKeyRing({
        activeKeyId: 'key-new',
        keys: {
          'key-old': createKey(31),
          'key-new': createKey(47),
        },
      }),
    )

    await expect(rotatedReader.decrypt({ envelope, additionalAuthenticatedData })).resolves.toEqual(
      encode(PLAINTEXT_SENTINEL),
    )
  })

  test('rejects an unknown key ID without trying a matching key under another ID', async () => {
    const writer = createSecretEnvelopeProvider(createKeyRing())
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await writer.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData,
    })
    const reader = createSecretEnvelopeProvider(
      createKeyRing({
        activeKeyId: 'replacement-id',
        keys: { 'replacement-id': createKey() },
      }),
    )
    const error = await captureFailure(() => reader.decrypt({ envelope, additionalAuthenticatedData }))

    expect(error).toBeInstanceOf(SecretEnvelopeError)
    expect((error as SecretEnvelopeError).code).toBe('UNKNOWN_KEY')
  })

  test('reports decryption failure for the wrong key under the expected key ID', async () => {
    const writer = createSecretEnvelopeProvider(
      createKeyRing({
        keys: { 'key-v1': createKey(61) },
      }),
    )
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await writer.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData,
    })
    const wrongKeyReader = createSecretEnvelopeProvider(
      createKeyRing({
        keys: { 'key-v1': createKey(62) },
      }),
    )
    const error = await captureFailure(() =>
      wrongKeyReader.decrypt({
        envelope,
        additionalAuthenticatedData,
      }),
    )

    expect(error).toBeInstanceOf(SecretEnvelopeError)
    expect((error as SecretEnvelopeError).code).toBe('DECRYPTION_FAILED')
  })
})
