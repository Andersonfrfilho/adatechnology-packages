/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { createHash } from 'node:crypto'

const S3_XML_NAMESPACE = 'http://s3.amazonaws.com/doc/2006-03-01/'

type SyntheticObject = {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly sha256: string
  readonly entityTag: string
}

export type SyntheticS3Server = {
  readonly endpoint: URL
  readonly requestPaths: string[]
  failNextRequest(): void
  reset(): void
  close(): Promise<void>
}

type ObjectLocation = {
  readonly bucket: string
  readonly key: string
}

function createS3Error(status: number, code: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`,
    { status, headers: { 'content-type': 'application/xml' } },
  )
}

function parseObjectLocation(pathname: string): ObjectLocation | undefined {
  const segments = pathname.split('/').filter(Boolean)
  const bucket = segments.shift()
  if (!bucket || segments.length === 0) return undefined

  return { bucket, key: segments.map(decodeURIComponent).join('/') }
}

function createObjectHeaders(storedObject: SyntheticObject): Headers {
  return new Headers({
    'content-length': storedObject.bytes.byteLength.toString(),
    'content-type': storedObject.contentType,
    etag: storedObject.entityTag,
    'x-amz-meta-sha256': storedObject.sha256,
  })
}

function createListBucketsResponse(bucket: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><ListAllMyBucketsResult xmlns="${S3_XML_NAMESPACE}"><Buckets><Bucket><Name>${bucket}</Name></Bucket></Buckets></ListAllMyBucketsResult>`,
    { headers: { 'content-type': 'application/xml' } },
  )
}

export function startSyntheticS3Server(bucket: string): SyntheticS3Server {
  const objects = new Map<string, SyntheticObject>()
  const requestPaths: string[] = []
  let shouldFailNextRequest = false
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request): Promise<Response> {
      const url = new URL(request.url)
      requestPaths.push(url.pathname)
      if (shouldFailNextRequest) {
        shouldFailNextRequest = false
        return createS3Error(503, 'ServiceUnavailable')
      }

      if (request.method === 'GET' && url.pathname === '/') {
        return createListBucketsResponse(bucket)
      }
      if (request.method === 'HEAD' && url.pathname === `/${bucket}`) {
        return new Response(null, { status: 200 })
      }

      const location = parseObjectLocation(url.pathname)
      if (!location || location.bucket !== bucket) return createS3Error(404, 'NoSuchBucket')
      const storageKey = `${location.bucket}/${location.key}`
      const storedObject = objects.get(storageKey)

      if (request.method === 'PUT') {
        if (request.headers.get('if-none-match') !== '*') {
          return createS3Error(400, 'InvalidRequest')
        }
        if (storedObject) return createS3Error(412, 'PreconditionFailed')

        const bytes = new Uint8Array(await request.arrayBuffer())
        const entityTag = `"${createHash('md5').update(bytes).digest('hex')}"`
        objects.set(storageKey, {
          bytes,
          entityTag,
          contentType: request.headers.get('content-type') ?? 'application/octet-stream',
          sha256: request.headers.get('x-amz-meta-sha256') ?? '',
        })
        return new Response(null, { status: 200, headers: { etag: entityTag } })
      }

      if (request.method === 'HEAD') {
        if (!storedObject) return createS3Error(404, 'NoSuchKey')
        return new Response(null, { status: 200, headers: createObjectHeaders(storedObject) })
      }
      if (request.method === 'GET') {
        if (!storedObject) return createS3Error(404, 'NoSuchKey')
        return new Response(storedObject.bytes, { headers: createObjectHeaders(storedObject) })
      }
      if (request.method === 'DELETE') {
        objects.delete(storageKey)
        return new Response(null, { status: 204 })
      }

      return createS3Error(405, 'MethodNotAllowed')
    },
  })

  return {
    endpoint: new URL(`http://${server.hostname}:${server.port}`),
    requestPaths,
    failNextRequest(): void {
      shouldFailNextRequest = true
    },
    reset(): void {
      objects.clear()
      requestPaths.length = 0
      shouldFailNextRequest = false
    },
    async close(): Promise<void> {
      await server.stop(true)
    },
  }
}
