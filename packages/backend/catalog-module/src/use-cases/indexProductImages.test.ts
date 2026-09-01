/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import { CATALOG_ERROR_CODES } from '@adatechnology/catalog-contracts'

import type { CatalogDependencies } from './catalogModule.types'
import { IndexProductImagesUseCase } from './IndexProductImages.use-case'

type Row = { id: string; imageStorageKey: string }

function buildUseCase(overrides: {
  readonly rows?: Row[]
  readonly upserts?: unknown[]
  readonly failingKeys?: Set<string>
  readonly embedding?: readonly number[] | undefined
  readonly withFetch?: boolean
  readonly withVision?: boolean
}) {
  const dependencies = {
    config: { currency: 'BRL', locale: 'pt-BR' },
    products: { listIndexableImages: async () => overrides.rows ?? [] },
    ...(overrides.withVision === false
      ? {}
      : {
          vision: {
            name: 'clip',
            embeddingModel: { id: 'clip-vit-b32', dimensions: 512 },
            read: async () => ({ embedding: overrides.embedding, engine: 'clip' }),
          },
          productEmbeddings: {
            upsert: async (values: unknown) => {
              overrides.upserts?.push(values)
            },
          },
        }),
    ...(overrides.withFetch === false
      ? {}
      : {
          imageStorage: {
            fetch: async (key: string) => {
              if (overrides.failingKeys?.has(key)) throw new Error('objeto sumiu do bucket')
              return { buffer: Buffer.from([1]), mimeType: 'image/jpeg' }
            },
          },
        }),
  } as unknown as CatalogDependencies

  return new IndexProductImagesUseCase(dependencies)
}

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_value, index) => ({ id: `p${index}`, imageStorageKey: `k${index}` }))

describe('pre-condicoes', () => {
  it('sem porta de visao nao ha o que indexar', async () => {
    const useCase = buildUseCase({ withVision: false })

    await expect(useCase.execute({ companyId: 'e1' })).rejects.toThrow('desligada')
  })

  it('storage sem leitura culpa o storage, nao a visao', async () => {
    // O host que so publica imagem e nunca implementou `fetch` varreria a base inteira para gravar
    // nada. Afirmar o CODIGO e nao a mensagem e o que faz este teste valer: com um `toThrow`
    // generico ele passava tambem com o erro da porta errada, que era justamente o defeito.
    const useCase = buildUseCase({ withFetch: false })

    await expect(useCase.execute({ companyId: 'e1' })).rejects.toMatchObject({
      code: CATALOG_ERROR_CODES.IMAGE_STORAGE_DISABLED,
    })
  })
})

describe('a varredura', () => {
  it('indexa cada produto com o modelo corrente e a chave de origem', async () => {
    const upserts: unknown[] = []
    const useCase = buildUseCase({ rows: rows(2), upserts, embedding: [0.1, 0.2] })

    const result = await useCase.execute({ companyId: 'e1', batchSize: 50 })

    expect(result).toEqual({ indexed: 2, failed: 0, hasMore: false, lastId: 'p1' })
    expect(upserts[0]).toEqual({
      companyId: 'e1',
      productId: 'p0',
      model: 'clip-vit-b32',
      // A origem entra na chave: a foto de estudio nao pode ser sobrescrita pelo que vier de
      // cliente confirmado, senao a especializacao viraria substituicao.
      source: 'catalog',
      embedding: [0.1, 0.2],
      // A chave de origem e o que permite saber depois que a foto do produto mudou.
      sourceKey: 'k0',
    })
  })

  it('uma imagem sumida do bucket nao interrompe as outras', async () => {
    const upserts: unknown[] = []
    const useCase = buildUseCase({
      rows: rows(3),
      upserts,
      embedding: [0.1],
      failingKeys: new Set(['k1']),
    })

    const result = await useCase.execute({ companyId: 'e1', batchSize: 50 })

    expect(result.indexed).toBe(2)
    expect(result.failed).toBe(1)
    expect(upserts).toHaveLength(2)
  })

  it('engine sem vetor para a imagem conta como falha e segue', async () => {
    const upserts: unknown[] = []
    const useCase = buildUseCase({ rows: rows(2), upserts, embedding: undefined })

    const result = await useCase.execute({ companyId: 'e1', batchSize: 50 })

    expect(result).toEqual({ indexed: 0, failed: 2, hasMore: false, lastId: 'p1' })
    expect(upserts).toHaveLength(0)
  })

  it('pagina cheia sinaliza continuacao, e o cursor e o ultimo id', async () => {
    const useCase = buildUseCase({ rows: rows(2), embedding: [0.1] })

    const result = await useCase.execute({ companyId: 'e1', batchSize: 2 })

    // Paginacao por id, nao por offset: em varredura longa, uma insercao no meio deslocaria a
    // janela e pularia produtos sem ninguem perceber.
    expect(result.hasMore).toBe(true)
    expect(result.lastId).toBe('p1')
  })

  it('base sem imagem cadastrada termina limpo', async () => {
    const useCase = buildUseCase({ rows: [], embedding: [0.1] })

    expect(await useCase.execute({ companyId: 'e1' })).toEqual({ indexed: 0, failed: 0, hasMore: false })
  })
})
