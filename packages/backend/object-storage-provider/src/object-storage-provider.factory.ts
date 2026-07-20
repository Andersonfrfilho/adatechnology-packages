/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from './object-storage-provider.error'
import {
  calculateObjectBody,
  validateLocation,
  validateProviderConfig,
  validateSignedExpiration,
} from './object-storage-provider.validation'
import type { ObjectStorageProvider, ObjectStorageProviderConfig, StoredObject } from './object-storage-provider.types'

const UNAVAILABLE_MESSAGE = 'Object storage is unavailable'

function isMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'NoSuchKey' || error.name === 'NotFound' || error.name === 'NoSuchBucket'
}

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'PreconditionFailed' || error.name === 'ConditionalRequestConflict'
}

function unavailable(): ObjectStorageError {
  return new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.unavailable, UNAVAILABLE_MESSAGE)
}

function redactStreamErrors(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = source.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      try {
        const result = await reader.read()
        if (result.done) controller.close()
        else controller.enqueue(result.value)
      } catch {
        controller.error(unavailable())
      }
    },
    async cancel(): Promise<void> {
      try {
        await reader.cancel()
      } catch {
        return
      }
    },
  })
}

export function createObjectStorageProvider(config: ObjectStorageProviderConfig): ObjectStorageProvider {
  validateProviderConfig(config)
  const client = new S3Client({
    endpoint: config.endpoint.toString(),
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
  let isClosed = false

  function ensureOpen(): void {
    if (isClosed) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.providerClosed, 'Object storage provider is closed')
    }
  }

  async function head(input: { readonly bucket: string; readonly key: string }): Promise<StoredObject | undefined> {
    ensureOpen()
    validateLocation(input)
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }))
      return {
        provider: 's3',
        bucket: input.bucket,
        key: input.key,
        contentLength: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
        sha256: result.Metadata?.sha256 ?? '',
      }
    } catch (error) {
      if (isMissingError(error)) return undefined
      throw unavailable()
    }
  }

  return {
    async put(input) {
      ensureOpen()
      validateLocation(input)
      const bytes = await calculateObjectBody(input, config.maxObjectSizeBytes)
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: input.bucket,
            Key: input.key,
            Body: bytes,
            ContentLength: input.contentLength,
            ContentType: input.contentType,
            Metadata: { sha256: input.sha256 },
            IfNoneMatch: '*',
          }),
        )
        return {
          provider: 's3',
          bucket: input.bucket,
          key: input.key,
          contentLength: input.contentLength,
          contentType: input.contentType,
          sha256: input.sha256,
          disposition: 'created',
        }
      } catch (error) {
        if (!isConflictError(error)) throw unavailable()
        const existing = await head(input)
        if (existing?.sha256 === input.sha256) return { ...existing, disposition: 'replayed' }
        throw new ObjectStorageError(
          OBJECT_STORAGE_ERROR_CODES.objectConflict,
          'Object already exists with different content',
        )
      }
    },
    async get(input) {
      ensureOpen()
      validateLocation(input)
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.key }))
        if (!result.Body) throw new Error('Missing object body')
        return redactStreamErrors(result.Body.transformToWebStream())
      } catch {
        throw unavailable()
      }
    },
    head,
    async delete(input) {
      ensureOpen()
      validateLocation(input)
      try {
        await client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }))
      } catch {
        throw unavailable()
      }
    },
    async createSignedDownload(input) {
      ensureOpen()
      validateLocation(input)
      validateSignedExpiration(input.expiresInSeconds)
      try {
        return new URL(
          await getSignedUrl(client, new GetObjectCommand({ Bucket: input.bucket, Key: input.key }), {
            expiresIn: input.expiresInSeconds,
          }),
        )
      } catch {
        throw unavailable()
      }
    },
    async health() {
      ensureOpen()
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.healthCheckBucket }))
        return { status: 'up' }
      } catch {
        return { status: 'down' }
      }
    },
    async close() {
      if (isClosed) return
      isClosed = true
      client.destroy()
    },
  }
}
