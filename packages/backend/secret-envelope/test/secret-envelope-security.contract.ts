/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { describe, expect, mock, spyOn, test } from 'bun:test'

import { createSecretEnvelopeProvider, SecretEnvelopeError } from '../src'
import {
  AAD_SENTINEL,
  alterLastByteBase64Url,
  captureFailure,
  createKey,
  createKeyRing,
  encode,
  PLAINTEXT_SENTINEL,
  toBase64Url,
} from './secret-envelope-test.fixtures'

describe('secret envelope security contract', () => {
  test('never includes key, AAD, plaintext, or envelope sentinels in typed errors', async () => {
    const secretKey = createKey(71)
    const secretKeySentinel = toBase64Url(secretKey)
    const provider = createSecretEnvelopeProvider(
      createKeyRing({
        keys: { 'key-v1': secretKey },
      }),
    )
    const additionalAuthenticatedData = encode(AAD_SENTINEL)
    const envelope = await provider.encrypt({
      plaintext: encode(PLAINTEXT_SENTINEL),
      additionalAuthenticatedData,
    })
    const alteredEnvelope = {
      ...envelope,
      ciphertext: alterLastByteBase64Url(envelope.ciphertext),
    }
    const error = await captureFailure(() =>
      provider.decrypt({
        envelope: alteredEnvelope,
        additionalAuthenticatedData,
      }),
    )
    const visibleError = `${String(error)}${JSON.stringify(error)}`

    expect(error).toBeInstanceOf(SecretEnvelopeError)
    expect(visibleError).not.toContain(secretKeySentinel)
    expect(visibleError).not.toContain(AAD_SENTINEL)
    expect(visibleError).not.toContain(PLAINTEXT_SENTINEL)
    expect(visibleError).not.toContain(JSON.stringify(envelope))
  })

  test('does not write to console during successful or rejected operations', async () => {
    const consoleSpies = [
      spyOn(console, 'debug').mockImplementation(() => undefined),
      spyOn(console, 'error').mockImplementation(() => undefined),
      spyOn(console, 'info').mockImplementation(() => undefined),
      spyOn(console, 'log').mockImplementation(() => undefined),
      spyOn(console, 'warn').mockImplementation(() => undefined),
    ]

    try {
      const provider = createSecretEnvelopeProvider(createKeyRing())
      const additionalAuthenticatedData = encode(AAD_SENTINEL)
      const envelope = await provider.encrypt({
        plaintext: encode(PLAINTEXT_SENTINEL),
        additionalAuthenticatedData,
      })
      await provider.decrypt({ envelope, additionalAuthenticatedData })
      await captureFailure(() =>
        provider.decrypt({
          envelope: {
            ...envelope,
            ciphertext: alterLastByteBase64Url(envelope.ciphertext),
          },
          additionalAuthenticatedData,
        }),
      )

      for (const consoleSpy of consoleSpies) {
        expect(consoleSpy).not.toHaveBeenCalled()
      }
    } finally {
      mock.restore()
    }
  })

  test('normalizes hostile input accessors without leaking their errors', async () => {
    const provider = createSecretEnvelopeProvider(createKeyRing())
    const hostileProperty = (property: string, input: object = {}): object =>
      Object.defineProperty(input, property, {
        get: () => {
          throw new Error(PLAINTEXT_SENTINEL)
        },
      })
    const errors = await Promise.all([
      captureFailure(() =>
        provider.encrypt(
          hostileProperty('plaintext', {
            additionalAuthenticatedData: encode(AAD_SENTINEL),
          }) as Parameters<typeof provider.encrypt>[0],
        ),
      ),
      captureFailure(() =>
        provider.encrypt(hostileProperty('additionalAuthenticatedData') as Parameters<typeof provider.encrypt>[0]),
      ),
      captureFailure(() =>
        provider.decrypt(
          hostileProperty('envelope', {
            additionalAuthenticatedData: encode(AAD_SENTINEL),
          }) as Parameters<typeof provider.decrypt>[0],
        ),
      ),
    ])

    for (const error of errors) {
      expect(error).toBeInstanceOf(SecretEnvelopeError)
      expect((error as SecretEnvelopeError).code).toBe('INVALID_INPUT')
      expect(`${String(error)}${JSON.stringify(error)}`).not.toContain(PLAINTEXT_SENTINEL)
    }
  })
})
