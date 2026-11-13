/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { SECRET_KEY_SIZE_BYTES } from './secret-envelope.constant'
import { SecretEnvelopeConfigurationError } from './secret-envelope.error'
import type { SecretKeyRing } from './secret-envelope.types'

type SecretKeyEntry = {
  readonly rawKey: Uint8Array<ArrayBuffer>
  cryptoKeyPromise?: Promise<CryptoKey>
}

export type SecretKeyStore = Readonly<{
  activeKeyId: string
  getCryptoKey: (keyId: string) => Promise<CryptoKey> | undefined
}>

export function createSecretKeyStore(keyRing: SecretKeyRing): SecretKeyStore {
  const snapshot = snapshotKeyRing(keyRing)
  const entries = new Map<string, SecretKeyEntry>()

  for (const [keyId, rawKey] of snapshot.keys) {
    entries.set(keyId, { rawKey })
  }

  return Object.freeze({
    activeKeyId: snapshot.activeKeyId,
    getCryptoKey(keyId: string): Promise<CryptoKey> | undefined {
      const entry = entries.get(keyId)
      if (!entry) return undefined

      entry.cryptoKeyPromise ??= importSecretKey(entry.rawKey)
      return entry.cryptoKeyPromise
    },
  })
}

type SecretKeyRingSnapshot = Readonly<{
  activeKeyId: string
  keys: ReadonlyMap<string, Uint8Array<ArrayBuffer>>
}>

function snapshotKeyRing(value: unknown): SecretKeyRingSnapshot {
  try {
    if (!isRecord(value)) throw new SecretEnvelopeConfigurationError()

    const activeKeyId = value.activeKeyId
    const keys = value.keys
    if (!isNonEmptyString(activeKeyId) || !isRecord(keys)) {
      throw new SecretEnvelopeConfigurationError()
    }

    const keyEntries = Object.entries(keys)
    if (keyEntries.length === 0 || Reflect.ownKeys(keys).length !== keyEntries.length) {
      throw new SecretEnvelopeConfigurationError()
    }

    const snapshots = new Map<string, Uint8Array<ArrayBuffer>>()
    for (const [keyId, rawKey] of keyEntries) {
      if (!isNonEmptyString(keyId) || !isValidRawKey(rawKey)) {
        throw new SecretEnvelopeConfigurationError()
      }
      snapshots.set(keyId, new Uint8Array(rawKey))
    }

    if (!snapshots.has(activeKeyId)) throw new SecretEnvelopeConfigurationError()
    return { activeKeyId, keys: snapshots }
  } catch (error: unknown) {
    if (error instanceof SecretEnvelopeConfigurationError) throw error
    throw new SecretEnvelopeConfigurationError()
  }
}

function importSecretKey(rawKey: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle
    .importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
    .finally(() => rawKey.fill(0))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isValidRawKey(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && value.byteLength === SECRET_KEY_SIZE_BYTES
}
