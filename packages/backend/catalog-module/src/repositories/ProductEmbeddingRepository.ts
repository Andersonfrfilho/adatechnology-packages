/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq, sql } from 'drizzle-orm'

import type { CatalogDatabase } from '../database.types'
import type { ProductEmbeddingSource } from '../schema/vision.schema'
import { productEmbeddingOwnedByCondition, productEmbeddingSearchCondition } from './conditions'

/**
 * Quantas linhas buscar por candidato desejado. Com varios vetores do mesmo produto no indice, os
 * N mais proximos podem ser todos do mesmo item — a folga e o que garante candidatos distintos
 * depois da deduplicacao.
 */
const OVERFETCH_FACTOR = 4
import { products } from '../schema/schema'
import { productEmbeddings } from '../schema/vision.schema'

export type NearestProductRow = {
  readonly productId: string
  readonly name: string
  readonly imageUrl: string | null
  readonly score: number
}

export type FindNearestParams = {
  readonly companyId: string
  readonly model: string
  readonly embedding: readonly number[]
  readonly limit: number
}

export class ProductEmbeddingRepository {
  constructor(private readonly db: CatalogDatabase) {}

  /**
   * Upsert na chave (produto, modelo): reindexar substitui, nunca acumula. Duas linhas do mesmo
   * produto concorreriam entre si na busca e gastariam o orçamento de candidatos com repetição.
   */
  async upsert(params: {
    readonly companyId: string
    readonly productId: string
    readonly model: string
    readonly source: ProductEmbeddingSource
    readonly embedding: readonly number[]
    readonly sourceKey: string
  }): Promise<void> {
    await this.db
      .insert(productEmbeddings)
      .values({
        companyId: params.companyId,
        productId: params.productId,
        model: params.model,
        source: params.source,
        embedding: [...params.embedding],
        sourceKey: params.sourceKey,
      })
      .onConflictDoUpdate({
        target: [productEmbeddings.productId, productEmbeddings.model, productEmbeddings.source],
        set: { embedding: [...params.embedding], sourceKey: params.sourceKey },
      })
  }

  /**
   * Vizinhos mais próximos por cosseno. O `<=>` do pgvector devolve DISTÂNCIA (0 = idêntico); o
   * score sai invertido para `1 = idêntico`, que é o que o resto do módulo e o `rank` do provider
   * esperam — inverter aqui, uma vez, evita cada consumidor lembrar de fazê-lo.
   *
   * O join com `products` filtra o que foi excluído ou desativado: vetor de produto apagado
   * continua na tabela até o cascade rodar, e responder com item morto é pior que não responder.
   */
  async findNearest(params: FindNearestParams): Promise<NearestProductRow[]> {
    const target = sql`${JSON.stringify([...params.embedding])}::vector`

    const rows = await this.db
      .select({
        productId: productEmbeddings.productId,
        name: products.name,
        imageUrl: products.imageUrl,
        score: sql<number>`1 - (${productEmbeddings.embedding} <=> ${target})`,
      })
      .from(productEmbeddings)
      .innerJoin(products, eq(products.id, productEmbeddings.productId))
      .where(productEmbeddingSearchCondition({ companyId: params.companyId, model: params.model }))
      .orderBy(sql`${productEmbeddings.embedding} <=> ${target}`)
      // Busca com folga e deduplica em memoria, em vez de `DISTINCT ON`: o `DISTINCT ON` exigiria
      // ordenar por `product_id` antes da distancia, e e a ordenacao por distancia que faz o
      // planejador usar o indice HNSW. Trocar o indice por um seq scan para evitar um `Map` seria
      // pagar caro pelo lado errado.
      .limit(params.limit * OVERFETCH_FACTOR)

    return dedupeByBestScore(rows.map((row) => ({ ...row, score: Number(row.score) }))).slice(0, params.limit)
  }

  async deleteByProduct(params: { readonly companyId: string; readonly productId: string }): Promise<void> {
    await this.db.delete(productEmbeddings).where(productEmbeddingOwnedByCondition(params))
  }

  /**
   * Modelos distintos ja gravados. Serve a uma pergunta so — "o indice foi construido por outro
   * modelo?" — e por isso devolve os nomes em vez de contar linhas: o operador precisa saber
   * qual reindexar.
   */
  async listIndexedModels(params: { readonly companyId: string }): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ model: productEmbeddings.model })
      .from(productEmbeddings)
      .where(eq(productEmbeddings.companyId, params.companyId))

    return rows.map((row) => row.model)
  }
}

/**
 * O melhor vetor de cada produto. As linhas ja chegam ordenadas por distancia, entao a primeira
 * ocorrencia de um produto e a melhor dele — e a ordem do resultado se preserva sozinha.
 *
 * Sem isto, um produto com foto de catalogo mais tres fotos de clientes ocuparia os quatro
 * primeiros lugares e a lista mostraria o mesmo item quatro vezes.
 */
function dedupeByBestScore(rows: readonly NearestProductRow[]): NearestProductRow[] {
  const best = new Map<string, NearestProductRow>()
  for (const row of rows) {
    if (!best.has(row.productId)) best.set(row.productId, row)
  }
  return [...best.values()]
}
