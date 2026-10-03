/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'

import type { ProductImageUnmatchedEvent, ProductVisionPort } from '@adatechnology/catalog-contracts'

import { VISION } from '../shared/vision.constant'
import type { CatalogDependencies } from './catalogModule.types'
import { IdentifyProductByImageUseCase } from './IdentifyProductByImage.use-case'

const JPEG = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }
const COMPANY = 'empresa-1'

type Nearest = { productId: string; name: string; imageUrl: string | null; score: number }

function buildUseCase(overrides: {
  readonly vision?: Partial<ProductVisionPort> | false
  readonly byBarcode?: { id: string } | undefined
  readonly nearest?: Nearest[]
  readonly unmatched?: ProductImageUnmatchedEvent[]
}) {
  const vision =
    overrides.vision === false
      ? undefined
      : {
          name: 'teste',
          embeddingModel: { id: 'clip-vit-b32', dimensions: 512 },
          read: async () => ({ engine: 'teste' }),
          ...overrides.vision,
        }

  const dependencies = {
    config: { currency: 'BRL', locale: 'pt-BR' },
    products: { findByBarcode: async () => overrides.byBarcode },
    ...(vision ? { vision, productEmbeddings: { findNearest: async () => overrides.nearest ?? [] } } : {}),
    hooks: {
      onProductImageUnmatched: (event: ProductImageUnmatchedEvent) => {
        overrides.unmatched?.push(event)
      },
    },
  } as unknown as CatalogDependencies

  return new IdentifyProductByImageUseCase(dependencies)
}

describe('capacidade por ausência', () => {
  it('sem porta de visão, identificar por imagem é erro de composição', async () => {
    const useCase = buildUseCase({ vision: false })

    await expect(useCase.execute({ companyId: COMPANY, ...JPEG })).rejects.toThrow(
      'Busca de produto por imagem está desligada para este módulo.',
    )
  })
})

describe('a cascata para no primeiro degrau que decide', () => {
  it('código de barras lido e produto existente decide sozinho', async () => {
    const useCase = buildUseCase({
      vision: { read: async () => ({ barcode: '7891000100103', engine: 'zbar' }) },
      byBarcode: { id: 'produto-do-gtin' },
      // Vizinho perfeito no índice: se a cascata não parasse no código de barras, este venceria.
      nearest: [{ productId: 'outro', name: 'Outro', imageUrl: null, score: 0.99 }],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({
      outcome: 'barcode',
      productId: 'produto-do-gtin',
      barcode: '7891000100103',
    })
  })

  it('código lido sem produto cadastrado ainda tenta o vetor', async () => {
    // O item existe no catálogo mas ninguém preencheu o GTIN. Desistir na leitura do código
    // perderia exatamente o produto que a foto mostra.
    const useCase = buildUseCase({
      vision: { read: async () => ({ barcode: '7891000100103', embedding: [0.1], engine: 'cadeia' }) },
      byBarcode: undefined,
      nearest: [{ productId: 'produto-sem-gtin', name: 'Leite', imageUrl: null, score: 0.9 }],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({
      outcome: 'candidates',
      candidates: [{ productId: 'produto-sem-gtin', name: 'Leite', score: 0.9 }],
    })
  })
})

describe('o piso de score', () => {
  it('vizinho abaixo do mínimo não vira candidato', async () => {
    const useCase = buildUseCase({
      vision: { read: async () => ({ embedding: [0.1], engine: 'clip' }) },
      nearest: [{ productId: 'qualquer', name: 'Qualquer', imageUrl: null, score: VISION.MIN_SCORE - 0.01 }],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({ outcome: 'unmatched' })
  })
})

describe('o desempate', () => {
  it('sem `rank`, a escolha volta para a conversa', async () => {
    const useCase = buildUseCase({
      vision: { read: async () => ({ embedding: [0.1], engine: 'clip' }) },
      nearest: [
        { productId: 'a', name: 'A', imageUrl: 'http://x/a.jpg', score: 0.9 },
        { productId: 'b', name: 'B', imageUrl: null, score: 0.8 },
      ],
    })

    const result = await useCase.execute({ companyId: COMPANY, ...JPEG })

    expect(result).toEqual({
      outcome: 'candidates',
      candidates: [
        { productId: 'a', name: 'A', imageUrl: 'http://x/a.jpg', score: 0.9 },
        { productId: 'b', name: 'B', score: 0.8 },
      ],
    })
  })

  it('"nenhum destes" é definitivo, não devolve os candidatos recusados', async () => {
    const unmatched: ProductImageUnmatchedEvent[] = []
    const useCase = buildUseCase({
      vision: {
        read: async () => ({ embedding: [0.1], engine: 'clip' }),
        rank: async () => ({ engine: 'vlm' }),
      },
      nearest: [{ productId: 'a', name: 'A', imageUrl: null, score: 0.9 }],
      unmatched,
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({ outcome: 'unmatched' })
    expect(unmatched[0]?.bestScore).toBe(0.9)
    expect(unmatched[0]?.candidateCount).toBe(1)
  })

  it('id fora da lista degrada para escolha manual em vez de responder produto que ninguém ofereceu', async () => {
    const useCase = buildUseCase({
      vision: {
        read: async () => ({ embedding: [0.1], engine: 'clip' }),
        rank: async () => ({ productId: 'produto-que-nao-estava-na-lista', engine: 'vlm' }),
      },
      nearest: [{ productId: 'a', name: 'A', imageUrl: null, score: 0.9 }],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({
      outcome: 'candidates',
      candidates: [{ productId: 'a', name: 'A', score: 0.9 }],
    })
  })

  it('escolha válida vira match com o score do candidato', async () => {
    const useCase = buildUseCase({
      vision: {
        read: async () => ({ embedding: [0.1], engine: 'clip' }),
        rank: async () => ({ productId: 'b', engine: 'vlm' }),
      },
      nearest: [
        { productId: 'a', name: 'A', imageUrl: null, score: 0.9 },
        { productId: 'b', name: 'B', imageUrl: null, score: 0.7 },
      ],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({
      outcome: 'matched',
      productId: 'b',
      score: 0.7,
    })
  })
})

describe('a imagem é validada antes de gastar engine', () => {
  it('tipo não suportado é recusado', async () => {
    const useCase = buildUseCase({})

    await expect(
      useCase.execute({ companyId: COMPANY, bytes: new Uint8Array([1]), mimeType: 'image/svg+xml' }),
    ).rejects.toThrow()
  })

  it('imagem vazia é recusada', async () => {
    const useCase = buildUseCase({})

    await expect(
      useCase.execute({ companyId: COMPANY, bytes: new Uint8Array([]), mimeType: 'image/jpeg' }),
    ).rejects.toThrow()
  })
})

describe('o evento de não-casado não carrega a foto', () => {
  it('leva só metadado: nem bytes, nem chave de imagem', async () => {
    const unmatched: ProductImageUnmatchedEvent[] = []
    const useCase = buildUseCase({
      vision: { read: async () => ({ barcode: '789', engine: 'zbar' }) },
      byBarcode: undefined,
      unmatched,
    })

    await useCase.execute({ companyId: COMPANY, ...JPEG })

    const event = unmatched[0]
    expect(event).toBeDefined()
    expect(Object.keys(event as object).sort()).toEqual(['barcode', 'candidateCount', 'companyId', 'occurredAt'])
  })
})

describe('quando o desempate nao vale o tempo dele', () => {
  it('vencedor folgado dispensa a inferencia', async () => {
    // O desempate custa ~4s medidos, com alguem olhando o "digitando". Um vizinho quase identico
    // nao precisa de segunda opiniao.
    let desempatou = false
    const useCase = buildUseCase({
      vision: {
        read: async () => ({ embedding: [0.1], engine: 'clip' }),
        rank: async () => {
          desempatou = true
          return { productId: 'b', engine: 'vlm' }
        },
      },
      nearest: [
        { productId: 'a', name: 'A', imageUrl: null, score: 0.97 },
        { productId: 'b', name: 'B', imageUrl: null, score: 0.7 },
      ],
    })

    expect(await useCase.execute({ companyId: COMPANY, ...JPEG })).toEqual({
      outcome: 'matched',
      productId: 'a',
      score: 0.97,
    })
    expect(desempatou).toBe(false)
  })

  it('score alto com segundo colado ainda desempata', async () => {
    // Itens irmaos — mesmo produto, sabores diferentes — pontuam alto E parecido. E exatamente o
    // caso em que a segunda opiniao ganha o tempo dela de volta.
    let desempatou = false
    const useCase = buildUseCase({
      vision: {
        read: async () => ({ embedding: [0.1], engine: 'clip' }),
        rank: async () => {
          desempatou = true
          return { productId: 'b', engine: 'vlm' }
        },
      },
      nearest: [
        { productId: 'a', name: 'Iogurte Morango', imageUrl: null, score: 0.96 },
        { productId: 'b', name: 'Iogurte Coco', imageUrl: null, score: 0.95 },
      ],
    })

    expect((await useCase.execute({ companyId: COMPANY, ...JPEG })).outcome).toBe('matched')
    expect(desempatou).toBe(true)
  })
})
