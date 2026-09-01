/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Popula o indice visual a partir das imagens ja cadastradas. Sem esta varredura o indice nasce
 * vazio e a busca por foto responde "nao encontrei" para todo o catalogo — o modo de falha mais
 * silencioso desta capacidade, porque nada quebra.
 */

import { ImageStorageDisabledError, VisionDisabledError } from '@adatechnology/catalog-contracts'

import { PRODUCT_EMBEDDING_SOURCE } from '../schema/vision.schema'
import { VISION } from '../shared/vision.constant'
import type { CatalogDependencies } from './catalogModule.types'

export type IndexProductImagesParams = {
  readonly companyId: string
  /** Teto de produtos por execucao. O host chama de novo enquanto `hasMore` for verdadeiro. */
  readonly batchSize?: number
  readonly afterId?: string
}

export type IndexProductImagesResult = {
  readonly indexed: number
  readonly failed: number
  readonly hasMore: boolean
  /** Cursor da proxima pagina; ausente quando acabou. */
  readonly lastId?: string
}

export class IndexProductImagesUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: IndexProductImagesParams): Promise<IndexProductImagesResult> {
    const { vision, productEmbeddings, imageStorage } = this.dependencies
    if (!vision?.embeddingModel || !productEmbeddings) throw new VisionDisabledError()
    // Storage sem leitura e o caso do host que so publica imagem e nunca reprocessa. O erro e o
    // do storage, e nao o da visao: dizer "busca por imagem desligada" mandaria o operador
    // conferir a porta de visao, que esta certa, sem pista de que falta o `fetch` do bucket.
    if (!imageStorage?.fetch) throw new ImageStorageDisabledError()

    const batchSize = params.batchSize ?? VISION.INDEX_BATCH_SIZE
    const rows = await this.dependencies.products.listIndexableImages({
      companyId: params.companyId,
      limit: batchSize,
      ...(params.afterId ? { afterId: params.afterId } : {}),
    })

    let indexed = 0
    let failed = 0

    for (const row of rows) {
      try {
        const image = await imageStorage.fetch(row.imageStorageKey)
        const reading = await vision.read(image)
        // Engine que nao devolveu vetor para esta imagem nao e erro: pode ser um formato que ele
        // nao le. Contar como falha ajudaria a diagnosticar, e parar a varredura nao.
        if (!reading.embedding) {
          failed += 1
          continue
        }

        await productEmbeddings.upsert({
          companyId: params.companyId,
          productId: row.id,
          model: vision.embeddingModel.id,
          // Foto de estudio. O que vier de cliente confirmado entra como `feedback`, sem
          // sobrescrever esta linha.
          source: PRODUCT_EMBEDDING_SOURCE.CATALOG,
          embedding: reading.embedding,
          sourceKey: row.imageStorageKey,
        })
        indexed += 1
      } catch (error) {
        // Uma imagem apagada do bucket nao pode interromper a indexacao das outras: a varredura
        // roda sobre a base inteira, e abortar no primeiro problema deixaria o resto sem indice.
        failed += 1
        this.dependencies.logger?.warn('catalog.vision.index_failed', {
          productId: row.id,
          error: String(error),
        })
      }
    }

    const lastId = rows.at(-1)?.id

    return {
      indexed,
      failed,
      // A pagina cheia e o unico sinal de que pode haver mais: contar a base inteira custaria uma
      // varredura extra a cada lote.
      hasMore: rows.length === batchSize,
      ...(lastId ? { lastId } : {}),
    }
  }
}
