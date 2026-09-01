/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Com a `source` na chave, um produto passa a ter varios vetores: a foto de estudio e as fotos
 * reais que os clientes mandaram. A busca precisa continuar devolvendo PRODUTOS distintos.
 */

import { describe, expect, it } from 'bun:test'

import type { CatalogDatabase } from '../database.types'
import { ProductEmbeddingRepository } from './ProductEmbeddingRepository'

type Row = { productId: string; name: string; imageUrl: string | null; score: number }

function repositoryReturning(rows: Row[]) {
  let requestedLimit = 0
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (value: number) => {
      requestedLimit = value
      return Promise.resolve(rows)
    },
  }

  return {
    repository: new ProductEmbeddingRepository(chain as unknown as CatalogDatabase),
    requestedLimit: () => requestedLimit,
  }
}

const search = { companyId: 'e1', model: 'clip-vit-b32', embedding: [0.1], limit: 3 }

describe('candidatos sao produtos, nao vetores', () => {
  it('um produto com varias fotos aparece uma vez, com o melhor score', async () => {
    // Sem a deduplicacao, este produto ocuparia os tres lugares e a conversa mostraria o mesmo
    // item tres vezes — que e exatamente o que a chave nova permitiria acontecer.
    const { repository } = repositoryReturning([
      { productId: 'a', name: 'Leite', imageUrl: null, score: 0.95 },
      { productId: 'a', name: 'Leite', imageUrl: null, score: 0.9 },
      { productId: 'a', name: 'Leite', imageUrl: null, score: 0.8 },
      { productId: 'b', name: 'Cafe', imageUrl: null, score: 0.75 },
    ])

    const nearest = await repository.findNearest(search)

    expect(nearest.map((row) => row.productId)).toEqual(['a', 'b'])
    expect(nearest[0]?.score).toBe(0.95)
  })

  it('busca com folga para sobrar candidato distinto depois de deduplicar', async () => {
    const { repository, requestedLimit } = repositoryReturning([])

    await repository.findNearest(search)

    expect(requestedLimit()).toBeGreaterThan(search.limit)
  })

  it('a ordem por distancia sobrevive a deduplicacao', async () => {
    const { repository } = repositoryReturning([
      { productId: 'a', name: 'A', imageUrl: null, score: 0.9 },
      { productId: 'b', name: 'B', imageUrl: null, score: 0.85 },
      { productId: 'a', name: 'A', imageUrl: null, score: 0.84 },
      { productId: 'c', name: 'C', imageUrl: null, score: 0.7 },
    ])

    expect((await repository.findNearest(search)).map((row) => row.productId)).toEqual(['a', 'b', 'c'])
  })

  it('corta no limite pedido, nao no que foi buscado com folga', async () => {
    const { repository } = repositoryReturning([
      { productId: 'a', name: 'A', imageUrl: null, score: 0.9 },
      { productId: 'b', name: 'B', imageUrl: null, score: 0.8 },
      { productId: 'c', name: 'C', imageUrl: null, score: 0.7 },
      { productId: 'd', name: 'D', imageUrl: null, score: 0.6 },
    ])

    expect(await repository.findNearest({ ...search, limit: 2 })).toHaveLength(2)
  })
})
