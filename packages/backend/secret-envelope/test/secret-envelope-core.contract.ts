/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, test } from 'bun:test'

import { createSecretEnvelopeProvider } from '../src'
import { AAD_SENTINEL, createKey, createKeyRing, encode, PLAINTEXT_SENTINEL } from './secret-envelope-test.fixtures'

describe('secret envelope core contract', () => {
  test('round-trips arbitrary binary plaintext with mandatory AAD', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const plaintext = new Uint8Array([0, 255, 16, 32, 64, 128])
    const additionalAuthenticatedData = encode(AAD_SENTINEL)

    const envelope = await provider.encrypt({ plaintext, additionalAuthenticatedData })
    const decrypted = await provider.decrypt({ envelope, additionalAuthenticatedData })

    expect(decrypted).toEqual(plaintext)
    expect(envelope).toMatchObject({
      version: 1,
      algorithm: 'A256GCM',
      keyId: 'key-v1',
    })
  })

  test('uses a fresh 12-byte nonce for equal plaintext and AAD', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const input = {
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData: encode(AAD_SENTINEL),
    }

    const firstEnvelope = await provider.encrypt(input)
    const secondEnvelope = await provider.encrypt(input)

    expect(firstEnvelope.nonce).not.toBe(secondEnvelope.nonce)
    expect(firstEnvelope.ciphertext).not.toBe(secondEnvelope.ciphertext)
  })

  test('snapshots caller key bytes when the provider is created', async () => {
    const originalKey = createKey(23)
    const provider = createSecretEnvelopeProvider(
      createKeyRing({
        keys: { 'key-v1': originalKey },
      }),
    )
    originalKey.fill(0)

    const input = {
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData: encode(AAD_SENTINEL),
    }
    const envelope = await provider.encrypt(input)
    const reader = createSecretEnvelopeProvider(
      createKeyRing({
        keys: { 'key-v1': createKey(23) },
      }),
    )

    await expect(
      reader.decrypt({ envelope, additionalAuthenticatedData: input.additionalAuthenticatedData }),
    ).resolves.toEqual(input.plaintext)
  })

  test('returns immutable provider and envelope objects without exposed key bytes', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const envelope = await provider.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData: encode(AAD_SENTINEL),
    })

    expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.isFrozen(envelope)).toBe(true)
    expect(Reflect.ownKeys(provider).sort()).toEqual(['decrypt', 'encrypt'])
    expect(JSON.stringify(envelope)).not.toContain(PLAINTEXT_SENTINEL)
  })
})
