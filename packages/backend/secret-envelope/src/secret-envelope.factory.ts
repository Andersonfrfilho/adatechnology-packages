/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { encodeCanonicalBase64Url } from './secret-envelope-base64url.service'
import { createAuthenticatedData } from './secret-envelope-authenticated-data.service'
import {
  SECRET_AUTHENTICATION_TAG_SIZE_BITS,
  SECRET_ENVELOPE_ALGORITHM,
  SECRET_ENVELOPE_VERSION,
  SECRET_NONCE_SIZE_BYTES,
} from './secret-envelope.constant'
import { SecretEnvelopeConfigurationError, SecretEnvelopeError } from './secret-envelope.error'
import { createSecretKeyStore, type SecretKeyStore } from './secret-envelope-keyring.service'
import { validateDecryptInput, validateEncryptInput } from './secret-envelope-validation.service'
import type {
  DecryptSecretInput,
  EncryptSecretInput,
  SecretEnvelopeProvider,
  SecretEnvelopeV1,
  SecretKeyRing,
} from './secret-envelope.types'

export function createSecretEnvelopeProvider(keyRing: SecretKeyRing): SecretEnvelopeProvider {
  const keyStore = createSecretKeyStore(keyRing)

  return Object.freeze({
    encrypt: (input: EncryptSecretInput) => encryptSecret({ keyStore, input }),
    decrypt: (input: DecryptSecretInput) => decryptSecret({ keyStore, input }),
  })
}

type EncryptSecretParams = Readonly<{
  keyStore: SecretKeyStore
  input: EncryptSecretInput
}>

async function encryptSecret(params: EncryptSecretParams): Promise<SecretEnvelopeV1> {
  const input = validateEncryptInput(params.input)
  let authenticatedData: Uint8Array<ArrayBuffer> | undefined

  try {
    const keyPromise = params.keyStore.getCryptoKey(params.keyStore.activeKeyId)
    if (!keyPromise) throw new SecretEnvelopeConfigurationError()
    authenticatedData = createAuthenticatedData({
      keyId: params.keyStore.activeKeyId,
      additionalAuthenticatedData: input.additionalAuthenticatedData,
    })
    const cryptoKey = await keyPromise
    const nonce = crypto.getRandomValues(new Uint8Array(SECRET_NONCE_SIZE_BYTES))
    const encrypted = await crypto.subtle.encrypt(
      createAesGcmParameters({
        nonce,
        additionalAuthenticatedData: authenticatedData,
      }),
      cryptoKey,
      input.plaintext,
    )

    return Object.freeze({
      version: SECRET_ENVELOPE_VERSION,
      algorithm: SECRET_ENVELOPE_ALGORITHM,
      keyId: params.keyStore.activeKeyId,
      nonce: encodeCanonicalBase64Url(nonce),
      ciphertext: encodeCanonicalBase64Url(new Uint8Array(encrypted)),
    })
  } catch (error: unknown) {
    if (error instanceof SecretEnvelopeConfigurationError) throw error
    throw new SecretEnvelopeError('ENCRYPTION_FAILED')
  } finally {
    input.plaintext.fill(0)
    input.additionalAuthenticatedData.fill(0)
    authenticatedData?.fill(0)
  }
}

type DecryptSecretParams = Readonly<{
  keyStore: SecretKeyStore
  input: DecryptSecretInput
}>

async function decryptSecret(params: DecryptSecretParams): Promise<Uint8Array> {
  const input = validateDecryptInput(params.input)
  let authenticatedData: Uint8Array<ArrayBuffer> | undefined

  try {
    const keyPromise = params.keyStore.getCryptoKey(input.keyId)
    if (!keyPromise) throw new SecretEnvelopeError('UNKNOWN_KEY')
    authenticatedData = createAuthenticatedData({
      keyId: input.keyId,
      additionalAuthenticatedData: input.additionalAuthenticatedData,
    })
    const cryptoKey = await keyPromise
    const decrypted = await crypto.subtle.decrypt(
      createAesGcmParameters({
        nonce: input.nonce,
        additionalAuthenticatedData: authenticatedData,
      }),
      cryptoKey,
      input.ciphertext,
    )
    return new Uint8Array(decrypted)
  } catch (error: unknown) {
    if (error instanceof SecretEnvelopeError && error.code === 'UNKNOWN_KEY') throw error
    throw new SecretEnvelopeError('DECRYPTION_FAILED')
  } finally {
    input.additionalAuthenticatedData.fill(0)
    authenticatedData?.fill(0)
  }
}

type CreateAesGcmParametersInput = Readonly<{
  nonce: Uint8Array<ArrayBuffer>
  additionalAuthenticatedData: Uint8Array<ArrayBuffer>
}>

function createAesGcmParameters(input: CreateAesGcmParametersInput): AesGcmParams {
  return {
    name: 'AES-GCM',
    iv: input.nonce,
    additionalData: input.additionalAuthenticatedData,
    tagLength: SECRET_AUTHENTICATION_TAG_SIZE_BITS,
  }
}
