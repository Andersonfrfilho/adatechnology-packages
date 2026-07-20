/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { createHash } from 'node:crypto'

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  OBJECT_STORAGE_ERROR_CODES,
  ObjectStorageError,
  createObjectStorageProvider,
  type ObjectBody,
  type ObjectStorageProvider,
} from '../src'
import { startSyntheticS3Server, type SyntheticS3Server } from './synthetic-s3.server'

const BUCKET = 'transportada-test-private'
const KEY = 'tenants/tenant-1/nfe-documents/document-1/original/object-1.xml'
const CONTENT_TYPE = 'application/xml'
const SYNTHETIC_SECRET_ACCESS_KEY = 'synthetic-secret-key'
const ORIGINAL_BYTES = new TextEncoder().encode('<NFe id="synthetic"/>')
const DIFFERENT_BYTES = new TextEncoder().encode('<NFe id="different"/>')
let syntheticS3Server: SyntheticS3Server | undefined

function getSyntheticS3Server(): SyntheticS3Server {
  if (!syntheticS3Server) throw new Error('Synthetic S3 server was not started')
  return syntheticS3Server
}

function calculateSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function createProvider(): ObjectStorageProvider {
  return createObjectStorageProvider({
    endpoint: getSyntheticS3Server().endpoint,
    region: 'us-east-1',
    accessKeyId: 'synthetic-access-key',
    secretAccessKey: SYNTHETIC_SECRET_ACCESS_KEY,
    forcePathStyle: true,
  })
}

function createPutInput(body: ObjectBody = ORIGINAL_BYTES) {
  return {
    bucket: BUCKET,
    key: KEY,
    body,
    contentLength: ORIGINAL_BYTES.byteLength,
    contentType: CONTENT_TYPE,
    sha256: calculateSha256(ORIGINAL_BYTES),
    mode: 'create-only' as const,
  }
}

async function readBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

describe('ObjectStorageProvider public contract', () => {
  beforeAll(() => {
    syntheticS3Server = startSyntheticS3Server(BUCKET)
  })

  beforeEach(() => {
    getSyntheticS3Server().reset()
  })

  afterAll(async () => {
    await getSyntheticS3Server().close()
    syntheticS3Server = undefined
  })

  test('creates an immutable object from bytes with verified metadata', async () => {
    const stored = await createProvider().put(createPutInput())

    expect(stored).toEqual({
      provider: 's3',
      bucket: BUCKET,
      key: KEY,
      contentLength: ORIGINAL_BYTES.byteLength,
      contentType: CONTENT_TYPE,
      sha256: calculateSha256(ORIGINAL_BYTES),
      disposition: 'created',
    })
  })

  test('streams put and get without changing the original bytes', async () => {
    const provider = createProvider()
    const body = new Blob([ORIGINAL_BYTES]).stream()
    await provider.put(createPutInput(body))

    expect(await readBytes(await provider.get({ bucket: BUCKET, key: KEY }))).toEqual(ORIGINAL_BYTES)
  })

  test('treats the same key and SHA-256 as an idempotent replay', async () => {
    const provider = createProvider()
    await provider.put(createPutInput())

    expect((await provider.put(createPutInput())).disposition).toBe('replayed')
  })

  test('rejects a divergent hash conflict and never overwrites the bytes', async () => {
    const provider = createProvider()
    await provider.put(createPutInput())

    await expect(
      provider.put({
        ...createPutInput(DIFFERENT_BYTES),
        contentLength: DIFFERENT_BYTES.byteLength,
        sha256: calculateSha256(DIFFERENT_BYTES),
      }),
    ).rejects.toMatchObject({ code: OBJECT_STORAGE_ERROR_CODES.objectConflict })
    expect(await readBytes(await provider.get({ bucket: BUCKET, key: KEY }))).toEqual(ORIGINAL_BYTES)
  })

  test('rejects content length, SHA-256, and MIME mismatches before success', async () => {
    const provider = createProvider()

    await expect(
      provider.put({ ...createPutInput(), contentLength: ORIGINAL_BYTES.byteLength + 1 }),
    ).rejects.toMatchObject({ code: OBJECT_STORAGE_ERROR_CODES.contentLengthMismatch })
    await expect(provider.put({ ...createPutInput(), sha256: calculateSha256(DIFFERENT_BYTES) })).rejects.toMatchObject(
      { code: OBJECT_STORAGE_ERROR_CODES.sha256Mismatch },
    )
    await expect(provider.put({ ...createPutInput(new Blob([DIFFERENT_BYTES]).stream()) })).rejects.toMatchObject({
      code: OBJECT_STORAGE_ERROR_CODES.contentLengthMismatch,
    })
    await expect(
      provider.put({ ...createPutInput(), contentType: 'application/xml\r\nx-unsafe: value' }),
    ).rejects.toMatchObject({ code: OBJECT_STORAGE_ERROR_CODES.invalidContentType })
  })

  test('rejects invalid buckets, absolute keys, backslashes, and traversal segments', async () => {
    const provider = createProvider()
    const invalidLocations = [
      {
        location: { bucket: 'INVALID_BUCKET', key: KEY },
        code: OBJECT_STORAGE_ERROR_CODES.invalidBucket,
      },
      {
        location: { bucket: BUCKET, key: '/absolute.xml' },
        code: OBJECT_STORAGE_ERROR_CODES.invalidKey,
      },
      {
        location: { bucket: BUCKET, key: 'tenants\\tenant-1\\object.xml' },
        code: OBJECT_STORAGE_ERROR_CODES.invalidKey,
      },
      {
        location: { bucket: BUCKET, key: 'tenants/tenant-1/../tenant-2/object.xml' },
        code: OBJECT_STORAGE_ERROR_CODES.invalidKey,
      },
    ]

    for (const invalidLocation of invalidLocations) {
      await expect(provider.head(invalidLocation.location)).rejects.toMatchObject({
        code: invalidLocation.code,
      })
    }
  })

  test('returns stable errors without credentials, endpoint, bucket, or key', async () => {
    const provider = createProvider()
    getSyntheticS3Server().failNextRequest()

    try {
      await provider.get({ bucket: BUCKET, key: KEY })
      throw new Error('Expected storage operation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ObjectStorageError)
      expect((error as ObjectStorageError).code).toBe(OBJECT_STORAGE_ERROR_CODES.unavailable)
      expect((error as Error).message).not.toContain(SYNTHETIC_SECRET_ACCESS_KEY)
      expect((error as Error).message).not.toContain(getSyntheticS3Server().endpoint.toString())
      expect((error as Error).message).not.toContain(BUCKET)
      expect((error as Error).message).not.toContain(KEY)
    }
  })

  test('supports head, get, and idempotent delete lifecycle', async () => {
    const provider = createProvider()
    await provider.put(createPutInput())

    expect(await provider.head({ bucket: BUCKET, key: KEY })).toEqual({
      provider: 's3',
      bucket: BUCKET,
      key: KEY,
      contentLength: ORIGINAL_BYTES.byteLength,
      contentType: CONTENT_TYPE,
      sha256: calculateSha256(ORIGINAL_BYTES),
    })
    await provider.delete({ bucket: BUCKET, key: KEY })
    await provider.delete({ bucket: BUCKET, key: KEY })
    expect(await provider.head({ bucket: BUCKET, key: KEY })).toBeUndefined()
  })

  test('supports path-style health and rejects operations after close', async () => {
    const provider = createProvider()

    await provider.put(createPutInput())
    expect(getSyntheticS3Server().requestPaths).toContain(`/${BUCKET}/${KEY}`)
    expect(await provider.health()).toEqual({ status: 'up' })
    await provider.close()
    await provider.close()
    await expect(provider.head({ bucket: BUCKET, key: KEY })).rejects.toMatchObject({
      code: OBJECT_STORAGE_ERROR_CODES.providerClosed,
    })
  })

  test('creates only short-lived signed private download URLs', async () => {
    const provider = createProvider()
    const signedUrl = await provider.createSignedDownload({
      bucket: BUCKET,
      key: KEY,
      expiresInSeconds: 60,
    })

    expect(signedUrl).toBeInstanceOf(URL)
    expect(signedUrl.protocol).toBe('http:')
    await expect(
      provider.createSignedDownload({ bucket: BUCKET, key: KEY, expiresInSeconds: 301 }),
    ).rejects.toMatchObject({ code: OBJECT_STORAGE_ERROR_CODES.signedUrlExpirationInvalid })
    await expect(
      provider.createSignedDownload({ bucket: BUCKET, key: KEY, expiresInSeconds: 0 }),
    ).rejects.toMatchObject({ code: OBJECT_STORAGE_ERROR_CODES.signedUrlExpirationInvalid })
  })
})
