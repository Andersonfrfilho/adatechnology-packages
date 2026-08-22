/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Pontos de extensão do produto — é aqui que entra a regra que o módulo não pode ter (repor
 * estoque ao cancelar pedido, avisar o comprador quando um item some), sem ninguém editar código
 * do pacote.
 */

import type { CompanyId, ProductId, CatalogId, ProductSyncStatus } from './catalog.types'
import type { CatalogWebhookEvent, UnhandledCatalogWebhookEventDescriptor } from './webhook.types'

export const CATALOG_EVENT = {
  PRODUCT_CREATED: 'catalog.product.created',
  PRODUCT_UPDATED: 'catalog.product.updated',
  PRODUCT_DELETED: 'catalog.product.deleted',
  PRODUCT_OUT_OF_STOCK: 'catalog.product.out_of_stock',
  CATALOG_CREATED: 'catalog.catalog.created',
  CATALOG_DELETED: 'catalog.catalog.deleted',
  SYNC_SUCCEEDED: 'catalog.sync.succeeded',
  SYNC_FAILED: 'catalog.sync.failed',
  BULK_IMPORT_FINISHED: 'catalog.bulk_import.finished',
} as const
export type CatalogEvent = (typeof CATALOG_EVENT)[keyof typeof CATALOG_EVENT]

type BaseEvent = {
  readonly companyId: CompanyId
  readonly occurredAt: Date
}

export type ProductCreatedEvent = BaseEvent & { readonly productId: ProductId; readonly name: string }
export type ProductUpdatedEvent = BaseEvent & {
  readonly productId: ProductId
  /** Só os nomes dos campos alterados — valor de custo e margem não viajam em evento. */
  readonly changedFields: readonly string[]
}
export type ProductDeletedEvent = BaseEvent & { readonly productId: ProductId }

/** Disparado na transição para zero, não a cada venda — é o gatilho de reposição. */
export type ProductOutOfStockEvent = BaseEvent & { readonly productId: ProductId; readonly name: string }

export type CatalogCreatedEvent = BaseEvent & { readonly catalogId: CatalogId; readonly name: string }
export type CatalogDeletedEvent = BaseEvent & { readonly catalogId: CatalogId }

export type SyncSucceededEvent = BaseEvent & {
  readonly entity: 'product' | 'catalog'
  readonly entityId: string
  readonly externalId: string
}
export type SyncFailedEvent = BaseEvent & {
  readonly entity: 'product' | 'catalog'
  readonly entityId: string
  readonly errorCode: string
  readonly status: ProductSyncStatus
  readonly willRetry: boolean
}

export type BulkImportFinishedEvent = BaseEvent & {
  readonly succeeded: number
  readonly failed: number
}

/**
 * Hooks são `void`-tolerantes: falha de regra do produto não pode derrubar o salvamento de um
 * produto. O módulo loga e segue.
 */
export type CatalogHooks = {
  onProductCreated?(event: ProductCreatedEvent): Promise<void> | void
  onProductUpdated?(event: ProductUpdatedEvent): Promise<void> | void
  onProductDeleted?(event: ProductDeletedEvent): Promise<void> | void
  onProductOutOfStock?(event: ProductOutOfStockEvent): Promise<void> | void
  onCatalogCreated?(event: CatalogCreatedEvent): Promise<void> | void
  onCatalogDeleted?(event: CatalogDeletedEvent): Promise<void> | void
  onSyncSucceeded?(event: SyncSucceededEvent): Promise<void> | void
  onSyncFailed?(event: SyncFailedEvent): Promise<void> | void
  onBulkImportFinished?(event: BulkImportFinishedEvent): Promise<void> | void

  /**
   * A Meta avisou que algo mudou no catálogo **do lado dela** (produto editado no painel, item
   * reprovado na revisão, batch de importação concluído).
   *
   * É o sentido oposto da sincronização que já existe: hoje só empurramos daqui para lá, e uma
   * edição feita no Commerce Manager fica invisível até alguém comparar na mão.
   */
  onCatalogWebhookEvent?(event: CatalogWebhookEvent): Promise<void> | void

  /**
   * Chegou um `field` que este módulo não sabe tratar — ou um que sabe, mas com corpo fora do
   * schema (versão nova da API, campo assinado sem handler).
   *
   * Existe para que o webhook nunca seja um buraco negro: descartar em silêncio é indistinguível
   * de webhook que parou de chegar. Observar aqui é do host; o módulo não decide que é erro.
   */
  onUnhandledCatalogWebhookEvent?(details: UnhandledCatalogWebhookEventDescriptor): Promise<void> | void
}
