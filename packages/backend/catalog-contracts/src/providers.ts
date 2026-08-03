/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { CompanyId, MetaSyncConfig, Product, ProductAvailability } from './catalog.types'

/**
 * Upload de imagem de produto. Porta e não implementação porque o bucket é do host — e o pacote
 * não deve escolher entre S3, MinIO ou disco local por ele.
 * `@adatechnology/object-storage-provider` satisfaz esta forma.
 */
export interface ProductImageStoragePort {
  upload(params: {
    readonly buffer: Buffer
    readonly mimeType: string
    readonly key: string
  }): Promise<{ readonly url: string; readonly key: string }>
  delete?(key: string): Promise<void>
}

export type MetaProductPayload = {
  readonly retailerId: string
  readonly name: string
  readonly description: string
  readonly priceInCents: number
  readonly currency: string
  readonly imageUrl?: string
  readonly availability: ProductAvailability
}

export type MetaSyncOutcome =
  | { readonly outcome: 'synced'; readonly externalId: string }
  /** Erro do payload ou da conta: repetir não resolve, e a linha fica `failed` com o motivo. */
  | { readonly outcome: 'permanent'; readonly errorCode: string; readonly message: string }
  /** Rate limit ou indisponibilidade: o worker tenta de novo com backoff. */
  | { readonly outcome: 'retriable'; readonly errorCode: string; readonly message: string }

/**
 * Publicação na Meta Commerce. Satisfeita por um adaptador sobre o
 * `@adatechnology/meta-catalog-provider` (esse sim específico da Meta) — que o módulo **não importa**, para quem só quer
 * gerenciar catálogo interno não carregar cliente de Graph API (granularidade, §2 da regra).
 *
 * Ausente = `metaSync` desligado, e o módulo funciona inteiro sem ela.
 */
export interface MetaCatalogSyncPort {
  upsertProduct(payload: MetaProductPayload): Promise<MetaSyncOutcome>
  deleteProduct(externalId: string): Promise<void>
  upsertProductSet(params: { readonly name: string; readonly externalId?: string }): Promise<MetaSyncOutcome>
  deleteProductSet(externalId: string): Promise<void>
}

/**
 * Sugestão vinda de base externa (GTIN, OpenFoodFacts, distribuidor) para pré-preencher o
 * formulário. Opcional: sem ela, o campo de código de barras é só um campo.
 */
export interface ProductSuggestionPort {
  findByBarcode(barcode: string): Promise<
    | {
        readonly name: string
        readonly brand?: string
        readonly imageUrl?: string
        readonly category?: string
      }
    | undefined
  >
}

export interface ClockPort {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export type CatalogModuleConfig = {
  /** ISO 4217 — usado no payload da Meta e na conversão da importação em lote. */
  readonly currency: string
  readonly locale: string
  readonly metaSync?: MetaSyncConfig
  /**
   * Estoque zero derruba a disponibilidade automaticamente. Desligado, `availability` é decisão
   * manual — é o caso de quem vende sob encomenda e não quer sumir do catálogo por estar zerado.
   */
  readonly deriveAvailabilityFromInventory?: boolean
}

/** Projeção usada pelo canal de conversa (`meta-whatsapp-module` pluga isto no `CatalogPort`). */
export type CatalogProductLookup = {
  findByRetailerId(params: { readonly companyId: CompanyId; readonly retailerId: string }): Promise<Product | undefined>
  listForChannel(params: { readonly companyId: CompanyId; readonly search?: string }): Promise<readonly Product[]>
  consumeInventory(params: {
    readonly companyId: CompanyId
    readonly productId: string
    readonly quantity: number
  }): Promise<void>
}
