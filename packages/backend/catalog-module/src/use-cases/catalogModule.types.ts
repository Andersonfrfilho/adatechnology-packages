/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas estreitas dos use-cases — duck-typed sobre os repositórios, não a classe concreta. É o
 * que permite o teste injetar dublê em memória sem Postgres.
 */

import type {
  CatalogHooks,
  CatalogModuleConfig,
  ClockPort,
  LoggerPort,
  MetaCatalogSyncPort,
  ProductImageStoragePort,
  ProductSuggestionPort,
  ProductVisionPort,
  WebhookNonceStorePort,
} from '@adatechnology/catalog-contracts'

import type { CatalogRepository } from '../repositories/CatalogRepository'
import type { ProductEmbeddingRepository } from '../repositories/ProductEmbeddingRepository'
import type { ProductRepository } from '../repositories/ProductRepository'
import type { SectionRepository } from '../repositories/SectionRepository'

export type CatalogRepositories = {
  readonly products: ProductRepository
  readonly catalogs: CatalogRepository
  readonly sections: SectionRepository
}

export type CatalogDependencies = CatalogRepositories & {
  readonly config: CatalogModuleConfig
  readonly hooks?: CatalogHooks
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  readonly imageStorage?: ProductImageStoragePort
  readonly metaSync?: MetaCatalogSyncPort
  readonly productSuggestion?: ProductSuggestionPort
  readonly webhookNonceStore?: WebhookNonceStorePort
  readonly vision?: ProductVisionPort
  /**
   * Ausente junto com `vision`: o repositório só existe quando a migration da busca visual rodou,
   * e consultá-lo sem a tabela seria erro de SQL em vez de capacidade desligada.
   */
  readonly productEmbeddings?: ProductEmbeddingRepository
}

/**
 * Hook nunca derruba a operação: falha de regra do produto não pode impedir o salvamento de um
 * item de catálogo. Loga e segue (contrato documentado em `events.ts` do contracts).
 */
export async function runHook(params: {
  readonly dependencies: Pick<CatalogDependencies, 'logger'>
  readonly name: string
  readonly run: () => Promise<void> | void
}): Promise<void> {
  try {
    await params.run()
  } catch (error) {
    params.dependencies.logger?.warn('catalog.hook_failed', { hook: params.name, error: String(error) })
  }
}

export function nowOf(dependencies: Pick<CatalogDependencies, 'clock'>): Date {
  return dependencies.clock?.now() ?? new Date()
}
