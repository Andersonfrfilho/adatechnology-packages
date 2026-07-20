/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { createHash } from 'node:crypto'

import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from './object-storage-provider.error'
import type { ObjectLocation, ObjectStorageProviderConfig, PutObjectInput } from './object-storage-provider.types'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

function fail(code: keyof typeof OBJECT_STORAGE_ERROR_CODES, message: string): never {
  throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES[code], message)
}

export function validateProviderConfig(config: ObjectStorageProviderConfig): void {
  if (!config.region || !config.accessKeyId || !config.secretAccessKey) {
    fail('invalidConfiguration', 'Object storage configuration is invalid')
  }
  if (config.endpoint.protocol !== 'http:' && config.endpoint.protocol !== 'https:') {
    fail('invalidConfiguration', 'Object storage configuration is invalid')
  }
  if (!isValidBucket(config.healthCheckBucket)) {
    fail('invalidConfiguration', 'Object storage configuration is invalid')
  }
  if (!Number.isSafeInteger(config.maxObjectSizeBytes) || config.maxObjectSizeBytes < 1) {
    fail('invalidConfiguration', 'Object storage configuration is invalid')
  }
}

function isValidBucket(bucket: string): boolean {
  return BUCKET_PATTERN.test(bucket) && !bucket.includes('..')
}

export function validateLocation(location: ObjectLocation): void {
  if (!isValidBucket(location.bucket)) {
    fail('invalidBucket', 'Object storage bucket is invalid')
  }
  const segments = location.key.split('/')
  if (
    !location.key ||
    location.key.startsWith('/') ||
    location.key.includes('\\') ||
    segments.some((segment) => segment === '..' || segment === '.')
  ) {
    fail('invalidKey', 'Object storage key is invalid')
  }
}

export function validateSignedExpiration(expiresInSeconds: number): void {
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 300) {
    fail('signedUrlExpirationInvalid', 'Signed URL expiration is invalid')
  }
}

async function readStream(stream: ReadableStream<Uint8Array>, contentLength: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(contentLength)
  const reader = stream.getReader()
  let offset = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) return bytes.subarray(0, offset)
      if (offset + result.value.byteLength > contentLength) {
        await reader.cancel()
        fail('contentLengthMismatch', 'Object content length does not match')
      }
      bytes.set(result.value, offset)
      offset += result.value.byteLength
    }
  } catch (error) {
    if (error instanceof ObjectStorageError) throw error
    fail('unavailable', 'Object storage is unavailable')
  }
}

export async function calculateObjectBody(input: PutObjectInput, maxObjectSizeBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 0) {
    fail('contentLengthMismatch', 'Object content length does not match')
  }
  if (input.contentLength > maxObjectSizeBytes) fail('objectTooLarge', 'Object exceeds the configured size limit')
  if (!SHA256_PATTERN.test(input.sha256)) fail('sha256Mismatch', 'Object SHA-256 does not match')
  if (!input.contentType.trim() || /[\r\n]/.test(input.contentType))
    fail('invalidContentType', 'Object content type is invalid')

  const bytes =
    input.body instanceof Uint8Array ? new Uint8Array(input.body) : await readStream(input.body, input.contentLength)
  if (bytes.byteLength !== input.contentLength) fail('contentLengthMismatch', 'Object content length does not match')
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (actualSha256 !== input.sha256) fail('sha256Mismatch', 'Object SHA-256 does not match')
  return bytes
}
