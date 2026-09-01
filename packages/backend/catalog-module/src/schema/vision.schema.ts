/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { index, timestamp, uniqueIndex, uuid, varchar, vector } from 'drizzle-orm/pg-core'

import { catalogSchema, products } from './schema'

/**
 * A dimensão é fixa na coluna porque o índice HNSW exige tamanho declarado, e migration não lê
 * configuração do host. 512 é o CLIP ViT-B/32, o modelo de referência do
 * `@adatechnology/product-vision-provider`.
 *
 * Provider que declare outra dimensão é recusado no boot (`VisionModelMismatchError`) em vez de
 * gravar vetor truncado: um erro na subida é caro uma vez, e um índice envenenado responde
 * produto errado para sempre.
 */
export const PRODUCT_EMBEDDING_DIMENSIONS = 512

export const productEmbeddings = catalogSchema.table(
  'product_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /**
     * Quem gerou o vetor. Vetores de modelos diferentes são comparáveis em tipo e sem sentido em
     * significado — guardar o modelo é o que permite detectar a troca em vez de responder lixo.
     */
    model: varchar('model', { length: 64 }).notNull(),
    embedding: vector('embedding', { dimensions: PRODUCT_EMBEDDING_DIMENSIONS }).notNull(),
    /**
     * A chave da imagem que originou o vetor. É como a reindexação sabe que a foto do produto
     * mudou: sem isto, trocar a imagem deixaria o vetor antigo respondendo pelo produto novo.
     */
    sourceKey: varchar('source_key', { length: 512 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Um vetor por produto por modelo. Reindexar é upsert nesta chave, não acúmulo de linhas
    // órfãs que continuariam concorrendo na busca.
    uniqueIndex('idx_product_embeddings_product_model').on(table.productId, table.model),
    // HNSW com distância de cosseno: é a métrica dos embeddings de imagem normalizados, e o
    // índice é o que separa uma busca de milissegundos de um seq scan sobre o catálogo inteiro.
    index('idx_product_embeddings_hnsw').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('idx_product_embeddings_company').on(table.companyId, table.model),
  ],
)

export type ProductEmbeddingRow = typeof productEmbeddings.$inferSelect
export type NewProductEmbeddingRow = typeof productEmbeddings.$inferInsert
