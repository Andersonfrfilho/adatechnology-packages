/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { ObjectStorageProvider, PutObjectInput } from '@adatechnology/object-storage-provider'

import { createS3ProductImageStorage } from './S3ProductImageStorage'

const KEY = 'products/company-1/image.png'
const BYTES = Buffer.from([137, 80, 78, 71])

function buildStorage(publicBaseUrl = 'https://cdn.example/ada-products') {
  const puts: PutObjectInput[] = []
  const deletes: string[] = []

  const storage = {
    async put(input: PutObjectInput) {
      puts.push(input)
      return {
        bucket: input.bucket,
        key: input.key,
        provider: 's3' as const,
        contentLength: input.contentLength,
        contentType: input.contentType,
        sha256: input.sha256,
        disposition: 'created' as const,
      }
    },
    async delete(input: { key: string }) {
      deletes.push(input.key)
    },
  } as unknown as ObjectStorageProvider

  return { port: createS3ProductImageStorage({ storage, bucket: 'ada-products', publicBaseUrl }), puts, deletes }
}

describe('createS3ProductImageStorage', () => {
  it('grava no bucket e devolve a URL publica da chave', async () => {
    const { port, puts } = buildStorage()

    const result = await port.upload({ buffer: BYTES, mimeType: 'image/png', key: KEY })

    expect(puts[0]?.bucket).toBe('ada-products')
    expect(puts[0]?.contentType).toBe('image/png')
    expect(puts[0]?.contentLength).toBe(BYTES.byteLength)
    expect(puts[0]?.mode).toBe('create-only')
    expect(puts[0]?.sha256).toHaveLength(64)
    expect(result).toEqual({ url: `https://cdn.example/ada-products/${KEY}`, key: KEY })
  })

  it('calcula o sha256 do conteudo, e nao um digest qualquer', async () => {
    const { port, puts } = buildStorage()

    await port.upload({ buffer: BYTES, mimeType: 'image/png', key: KEY })

    const expected = new Bun.CryptoHasher('sha256').update(BYTES).digest('hex')
    expect(puts[0]?.sha256).toBe(expected)
  })

  it('nao duplica a barra quando a base publica termina com uma', async () => {
    const { port } = buildStorage('https://cdn.example/ada-products/')

    const result = await port.upload({ buffer: BYTES, mimeType: 'image/png', key: KEY })

    expect(result.url).toBe(`https://cdn.example/ada-products/${KEY}`)
  })

  it('remove pela chave, no bucket configurado', async () => {
    const { port, deletes } = buildStorage()

    await port.delete?.(KEY)

    expect(deletes).toEqual([KEY])
  })
})

describe('leitura para a indexacao visual', () => {
  function buildReadableStorage(stored?: { contentType: string }) {
    const storage = {
      async head() {
        return stored
          ? {
              bucket: 'ada-products',
              key: KEY,
              provider: 's3' as const,
              contentLength: BYTES.byteLength,
              contentType: stored.contentType,
              sha256: 'x',
            }
          : undefined
      },
      async get() {
        return new Response(new Uint8Array(BYTES)).body as ReadableStream<Uint8Array>
      },
    } as unknown as ObjectStorageProvider

    return createS3ProductImageStorage({ storage, bucket: 'ada-products', publicBaseUrl: 'https://cdn.example' })
  }

  it('devolve os bytes e o mime que o bucket registrou', async () => {
    const port = buildReadableStorage({ contentType: 'image/png' })

    const result = await port.fetch?.(KEY)

    expect(result?.mimeType).toBe('image/png')
    expect(result?.buffer.equals(BYTES)).toBe(true)
  })

  it('imagem sumida do bucket falha em vez de virar vetor em branco', async () => {
    // Catalogo antigo tem linha apontando para objeto ja apagado. Um stream vazio viraria o
    // embedding de uma imagem em branco, competindo com os produtos de verdade na busca.
    const port = buildReadableStorage(undefined)

    await expect(port.fetch?.(KEY)).rejects.toThrow('Imagem de produto não encontrada no bucket')
  })
})
