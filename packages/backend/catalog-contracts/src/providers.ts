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

/**
 * Guarda de reentrega do webhook. A Meta reentrega o mesmo evento quando o 200 demora ou se perde,
 * e sem isto um evento de catálogo seria processado duas vezes.
 *
 * Porta e não implementação: o host já tem Redis (ou o que for) — o pacote não escolhe por ele.
 * Ausente = sem proteção de reentrega, e o módulo diz isso no log em vez de fingir idempotência.
 */
export interface WebhookNonceStorePort {
  /** `true` = a chave foi criada agora (entrega inédita); `false` = já existia (reentrega). */
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
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
  readonly webhook?: CatalogWebhookConfig
}

/**
 * Webhook de catálogo. **Ausente = a rota não é publicada**, e não uma rota que aceita tudo: sem
 * segredo não há como distinguir a Meta de qualquer um que descubra a URL (fail-closed, §3 da
 * regra de segurança).
 */
export type CatalogWebhookConfig = {
  /** Segredo do app Meta; assina o corpo em `X-Hub-Signature-256`. */
  readonly appSecret: string
  /** O token que a Meta devolve no desafio `GET` ao salvar a URL no painel. */
  readonly verifyToken: string
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
