/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { eq, sql } from 'drizzle-orm'

import type { CatalogDatabase } from '../database.types'
import { productEmbeddingOwnedByCondition, productEmbeddingSearchCondition } from './conditions'
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
    readonly embedding: readonly number[]
    readonly sourceKey: string
  }): Promise<void> {
    await this.db
      .insert(productEmbeddings)
      .values({
        companyId: params.companyId,
        productId: params.productId,
        model: params.model,
        embedding: [...params.embedding],
        sourceKey: params.sourceKey,
      })
      .onConflictDoUpdate({
        target: [productEmbeddings.productId, productEmbeddings.model],
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
      .limit(params.limit)

    return rows.map((row) => ({ ...row, score: Number(row.score) }))
  }

  async deleteByProduct(params: { readonly companyId: string; readonly productId: string }): Promise<void> {
    await this.db.delete(productEmbeddings).where(productEmbeddingOwnedByCondition(params))
  }
}
