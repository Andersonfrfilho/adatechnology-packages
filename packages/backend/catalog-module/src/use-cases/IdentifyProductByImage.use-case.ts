/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A cascata que transforma uma foto em produto: código de barras, depois vetor, depois desempate.
 * A ordem não é preferência, é custo — cada degrau só roda porque o anterior não decidiu.
 */

import { InvalidProductImageError, VisionDisabledError } from '@adatechnology/catalog-contracts'
import type { ProductVisionCandidate } from '@adatechnology/catalog-contracts'

import { PRODUCT_IMAGE } from '../shared/productImage.constant'
import { VISION } from '../shared/vision.constant'
import type { CatalogDependencies } from './catalogModule.types'
import { nowOf, runHook } from './catalogModule.types'

export type IdentifyProductByImageParams = {
  readonly companyId: string
  readonly bytes: Uint8Array
  readonly mimeType: string
}

/**
 * União fechada porque quem responde é um canal de conversa, e cada desfecho vira uma mensagem
 * diferente: match exato confirma, candidatos viram escolha, vazio pede outra foto. Um resultado
 * com `productId?: string` obrigaria cada canal a redescobrir essa distinção.
 */
export type IdentifyProductByImageResult =
  | { readonly outcome: 'barcode'; readonly productId: string; readonly barcode: string }
  | { readonly outcome: 'matched'; readonly productId: string; readonly score: number }
  | { readonly outcome: 'candidates'; readonly candidates: readonly ProductVisionCandidate[] }
  | { readonly outcome: 'unmatched' }

export class IdentifyProductByImageUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: IdentifyProductByImageParams): Promise<IdentifyProductByImageResult> {
    const vision = this.dependencies.vision
    if (!vision) throw new VisionDisabledError()

    assertUsableImage(params)

    const image = { buffer: Buffer.from(params.bytes), mimeType: normalizeMimeType(params.mimeType) }
    const reading = await vision.read(image)

    if (reading.barcode) {
      const product = await this.dependencies.products.findByBarcode({
        companyId: params.companyId,
        barcode: reading.barcode,
      })
      // Código lido e produto encontrado decide sozinho: `barcode` é único por empresa, então não
      // há similaridade a ponderar. Código lido e produto ausente NÃO encerra — a foto ainda pode
      // casar pelo vetor, e desistir aqui perderia o item cadastrado sem o GTIN preenchido.
      if (product) return { outcome: 'barcode', productId: product.id, barcode: reading.barcode }
    }

    const candidates = await this.findCandidates({ companyId: params.companyId, reading })

    if (candidates.length === 0) {
      await this.reportUnmatched({ companyId: params.companyId, barcode: reading.barcode, candidates })
      return { outcome: 'unmatched' }
    }

    if (!vision.rank) return { outcome: 'candidates', candidates }

    // Vencedor folgado dispensa o desempate: ele custa segundos de inferencia, e o cliente esta
    // olhando o "digitando". A margem importa tanto quanto o score — dois itens irmaos pontuam
    // alto e parecido, e e ai que a segunda opiniao vale o tempo dela.
    const [primeiro, segundo] = candidates
    if (primeiro && primeiro.score >= VISION.RANK_SKIP_SCORE) {
      const margem = primeiro.score - (segundo?.score ?? 0)
      if (margem >= VISION.RANK_SKIP_MARGIN) {
        return { outcome: 'matched', productId: primeiro.productId, score: primeiro.score }
      }
    }

    const ranking = await vision.rank({ image, candidates })
    if (!ranking.productId) {
      // "Nenhum destes" é resposta do desempate, e é definitiva: devolver os candidatos que ele
      // acabou de recusar transformaria a recusa em sugestão.
      await this.reportUnmatched({ companyId: params.companyId, barcode: reading.barcode, candidates })
      return { outcome: 'unmatched' }
    }

    const chosen = candidates.find((candidate) => candidate.productId === ranking.productId)
    // Desempate que devolve id fora da lista é engine quebrado ou alucinação; cair para a escolha
    // manual é degradar, aceitar seria responder um produto que ninguém ofereceu.
    if (!chosen) {
      this.dependencies.logger?.warn('catalog.vision.rank_out_of_candidates', { engine: ranking.engine })
      return { outcome: 'candidates', candidates }
    }

    return { outcome: 'matched', productId: chosen.productId, score: chosen.score }
  }

  private async findCandidates(params: {
    readonly companyId: string
    readonly reading: { readonly embedding?: readonly number[] }
  }): Promise<readonly ProductVisionCandidate[]> {
    const { embedding } = params.reading
    const model = this.dependencies.vision?.embeddingModel
    const repository = this.dependencies.productEmbeddings
    if (!embedding || !model || !repository) return []

    const nearest = await repository.findNearest({
      companyId: params.companyId,
      model: model.id,
      embedding,
      limit: VISION.CANDIDATE_LIMIT,
    })

    return nearest
      .filter((row) => row.score >= VISION.MIN_SCORE)
      .map((row) => ({
        productId: row.productId,
        name: row.name,
        ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
        score: row.score,
      }))
  }

  private async reportUnmatched(params: {
    readonly companyId: string
    readonly barcode?: string
    readonly candidates: readonly ProductVisionCandidate[]
  }): Promise<void> {
    const hook = this.dependencies.hooks?.onProductImageUnmatched
    if (!hook) return

    const best = params.candidates[0]
    await runHook({
      dependencies: this.dependencies,
      name: 'onProductImageUnmatched',
      run: () =>
        hook({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          ...(params.barcode ? { barcode: params.barcode } : {}),
          ...(best ? { bestScore: best.score } : {}),
          candidateCount: params.candidates.length,
        }),
    })
  }
}

function assertUsableImage(params: IdentifyProductByImageParams): void {
  if (!PRODUCT_IMAGE.EXTENSION_BY_MIME[normalizeMimeType(params.mimeType)]) {
    throw new InvalidProductImageError('unsupported_type')
  }
  if (params.bytes.byteLength === 0) throw new InvalidProductImageError('empty')
  if (params.bytes.byteLength > PRODUCT_IMAGE.MAX_BYTES) throw new InvalidProductImageError('too_large')
}

function normalizeMimeType(value: string): string {
  return (value.split(';')[0] ?? '').trim().toLowerCase()
}
