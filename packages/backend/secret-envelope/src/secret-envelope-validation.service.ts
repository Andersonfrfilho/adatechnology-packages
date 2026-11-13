/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import {
  SECRET_AUTHENTICATION_TAG_SIZE_BYTES,
  SECRET_CIPHERTEXT_LIMIT_BYTES,
  SECRET_ENVELOPE_ALGORITHM,
  SECRET_ENVELOPE_VERSION,
  SECRET_NONCE_SIZE_BYTES,
  SECRET_PLAINTEXT_LIMIT_BYTES,
} from './secret-envelope.constant'
import { decodeCanonicalBase64Url } from './secret-envelope-base64url.service'
import { SecretEnvelopeError } from './secret-envelope.error'
import type { DecryptSecretInput, EncryptSecretInput } from './secret-envelope.types'

const ENVELOPE_KEYS = ['version', 'algorithm', 'keyId', 'nonce', 'ciphertext'] as const

export type ValidatedEncryptInput = Readonly<{
  plaintext: Uint8Array<ArrayBuffer>
  additionalAuthenticatedData: Uint8Array<ArrayBuffer>
}>

export type ValidatedDecryptInput = Readonly<{
  keyId: string
  nonce: Uint8Array<ArrayBuffer>
  ciphertext: Uint8Array<ArrayBuffer>
  additionalAuthenticatedData: Uint8Array<ArrayBuffer>
}>

export function validateEncryptInput(input: EncryptSecretInput): ValidatedEncryptInput {
  const record = requireRecord(input)
  const additionalAuthenticatedData = copyNonEmptyAad(readProperty(record, 'additionalAuthenticatedData'))
  const plaintext = copyBytes(readProperty(record, 'plaintext'))

  if (plaintext.byteLength > SECRET_PLAINTEXT_LIMIT_BYTES) {
    plaintext.fill(0)
    additionalAuthenticatedData.fill(0)
    throw new SecretEnvelopeError('PLAINTEXT_TOO_LARGE')
  }

  return { plaintext, additionalAuthenticatedData }
}

export function validateDecryptInput(input: DecryptSecretInput): ValidatedDecryptInput {
  const record = requireRecord(input)
  const additionalAuthenticatedData = copyNonEmptyAad(readProperty(record, 'additionalAuthenticatedData'))
  const envelope = parseEnvelope(readProperty(record, 'envelope'))

  return { ...envelope, additionalAuthenticatedData }
}

function parseEnvelope(value: unknown): Omit<ValidatedDecryptInput, 'additionalAuthenticatedData'> {
  try {
    const record = requireEnvelopeRecord(value)
    if (
      record.version !== SECRET_ENVELOPE_VERSION ||
      record.algorithm !== SECRET_ENVELOPE_ALGORITHM ||
      typeof record.keyId !== 'string' ||
      record.keyId.length === 0 ||
      typeof record.nonce !== 'string' ||
      typeof record.ciphertext !== 'string'
    ) {
      throw new SecretEnvelopeError('INVALID_ENVELOPE')
    }

    const nonce = decodeCanonicalBase64Url({
      value: record.nonce,
      maximumDecodedBytes: SECRET_NONCE_SIZE_BYTES,
    })
    const ciphertext = decodeCanonicalBase64Url({
      value: record.ciphertext,
      maximumDecodedBytes: SECRET_CIPHERTEXT_LIMIT_BYTES,
    })
    if (nonce.byteLength !== SECRET_NONCE_SIZE_BYTES || ciphertext.byteLength < SECRET_AUTHENTICATION_TAG_SIZE_BYTES) {
      throw new SecretEnvelopeError('INVALID_ENVELOPE')
    }

    return { keyId: record.keyId, nonce, ciphertext }
  } catch {
    throw new SecretEnvelopeError('INVALID_ENVELOPE')
  }
}

function requireEnvelopeRecord(value: unknown): Record<string, unknown> {
  const record = requireRecord(value, 'INVALID_ENVELOPE')
  const keys = Reflect.ownKeys(record)
  if (keys.length !== ENVELOPE_KEYS.length || !ENVELOPE_KEYS.every((key) => keys.includes(key))) {
    throw new SecretEnvelopeError('INVALID_ENVELOPE')
  }
  return record
}

function requireRecord(
  value: unknown,
  code: 'INVALID_INPUT' | 'INVALID_ENVELOPE' = 'INVALID_INPUT',
): Record<string, unknown> {
  try {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  } catch {
    throw new SecretEnvelopeError(code)
  }
  throw new SecretEnvelopeError(code)
}

function readProperty(record: Record<string, unknown>, property: string): unknown {
  try {
    return record[property]
  } catch {
    throw new SecretEnvelopeError('INVALID_INPUT')
  }
}

function copyBytes(value: unknown): Uint8Array<ArrayBuffer> {
  if (!(value instanceof Uint8Array)) {
    throw new SecretEnvelopeError('INVALID_INPUT')
  }
  return new Uint8Array(value)
}

function copyNonEmptyAad(value: unknown): Uint8Array<ArrayBuffer> {
  const additionalAuthenticatedData = copyBytes(value)
  if (additionalAuthenticatedData.byteLength === 0) {
    throw new SecretEnvelopeError('INVALID_INPUT')
  }
  return additionalAuthenticatedData
}
