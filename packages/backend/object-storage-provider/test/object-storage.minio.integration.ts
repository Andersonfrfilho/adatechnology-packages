/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { createHash, randomUUID } from 'node:crypto'

import { CreateBucketCommand, DeleteBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { afterAll, beforeAll, expect, test } from 'bun:test'

import { OBJECT_STORAGE_ERROR_CODES, createObjectStorageProvider, type ObjectStorageProvider } from '../src'

const endpoint = new URL(process.env.OBJECT_STORAGE_TEST_ENDPOINT ?? '')
const region = process.env.OBJECT_STORAGE_TEST_REGION ?? ''
const accessKeyId = process.env.OBJECT_STORAGE_TEST_ACCESS_KEY_ID ?? ''
const secretAccessKey = process.env.OBJECT_STORAGE_TEST_SECRET_ACCESS_KEY ?? ''
const bucket = `transportada-storage-${randomUUID()}`
const key = `tenants/synthetic/documents/${randomUUID()}.xml`
const bytes = new TextEncoder().encode('<NFe id="synthetic-minio"/>')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const administrationClient = new S3Client({
  endpoint: endpoint.toString(),
  region,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
})
let provider: ObjectStorageProvider | undefined

function getProvider(): ObjectStorageProvider {
  if (!provider) throw new Error('Object storage provider was not started')
  return provider
}

beforeAll(async () => {
  await administrationClient.send(new CreateBucketCommand({ Bucket: bucket }))
  provider = createObjectStorageProvider({
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: true,
    healthCheckBucket: bucket,
    maxObjectSizeBytes: 1024 * 1024,
  })
})

afterAll(async () => {
  if (provider) {
    await provider.delete({ bucket, key })
    await provider.close()
  }
  await administrationClient.send(new DeleteBucketCommand({ Bucket: bucket }))
  administrationClient.destroy()
})

test('proves immutable lifecycle against a real MinIO server', async () => {
  const objectStorageProvider = getProvider()
  const input = {
    bucket,
    key,
    body: new Blob([bytes]).stream(),
    contentLength: bytes.byteLength,
    contentType: 'application/xml',
    sha256,
    mode: 'create-only' as const,
  }

  expect((await objectStorageProvider.put(input)).disposition).toBe('created')
  expect((await objectStorageProvider.put({ ...input, body: bytes })).disposition).toBe('replayed')
  const divergentBytes = Uint8Array.of(1)
  await expect(
    objectStorageProvider.put({
      ...input,
      body: divergentBytes,
      contentLength: divergentBytes.byteLength,
      sha256: createHash('sha256').update(divergentBytes).digest('hex'),
    }),
  ).rejects.toMatchObject({
    code: OBJECT_STORAGE_ERROR_CODES.objectConflict,
  })
  expect(new Uint8Array(await new Response(await objectStorageProvider.get({ bucket, key })).arrayBuffer())).toEqual(
    bytes,
  )
  expect(await objectStorageProvider.head({ bucket, key })).toMatchObject({ sha256, contentLength: bytes.byteLength })
  expect((await objectStorageProvider.createSignedDownload({ bucket, key, expiresInSeconds: 60 })).search).toContain(
    'X-Amz-Signature=',
  )
  expect(await objectStorageProvider.health()).toEqual({ status: 'up' })
})

test('makes a real MinIO answer the signed download with the requested disposition', async () => {
  const objectStorageProvider = getProvider()
  const downloadKey = `tenants/synthetic/documents/${randomUUID()}.xml`
  await objectStorageProvider.put({
    bucket,
    key: downloadKey,
    body: bytes,
    contentLength: bytes.byteLength,
    contentType: 'application/xml',
    sha256,
    mode: 'create-only',
  })

  try {
    const signedDownload = (extra: { disposition?: 'attachment'; filename?: string }): Promise<URL> =>
      objectStorageProvider.createSignedDownload({ bucket, key: downloadKey, expiresInSeconds: 60, ...extra })
    const withoutDisposition = await fetch(await signedDownload({}))
    const attachment = await fetch(
      await signedDownload({ disposition: 'attachment', filename: 'relatório de frete.xml' }),
    )

    // Sem disposição o navegador decide pelo content-type — é isso que abre XML na aba.
    expect(withoutDisposition.headers.get('content-disposition')).toBeNull()
    expect(await withoutDisposition.text()).toBe(new TextDecoder().decode(bytes))
    expect(attachment.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''relat%C3%B3rio%20de%20frete.xml",
    )
    expect(await attachment.text()).toBe(new TextDecoder().decode(bytes))

    // A disposição está dentro da assinatura: trocá-la na mão invalida a URL.
    const tampered = await signedDownload({ disposition: 'attachment', filename: 'relatório de frete.xml' })
    tampered.searchParams.set('response-content-disposition', 'inline')
    expect((await fetch(tampered)).status).toBe(403)
  } finally {
    await objectStorageProvider.delete({ bucket, key: downloadKey })
  }
})
