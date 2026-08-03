/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tradução linha do banco → tipo do contracts. Fica num arquivo só porque a conversão
 * `null → undefined` precisa ser consistente: o banco não tem `undefined`, e o contrato usa
 * `undefined` para "campo não informado" e `null` para "explicitamente vazio".
 */

import { PRODUCT_AVAILABILITY } from '@adatechnology/catalog-contracts'
import type {
  Catalog,
  Product,
  ProductAvailability,
  ProductSyncStatus,
  Section,
} from '@adatechnology/catalog-contracts'

import type { CatalogRow, ProductRow, SectionRow } from '../schema/schema'
import type { CatalogWithCount } from '../repositories/CatalogRepository'

export type ProductProjection = 'admin' | 'customer'

/**
 * `projection: 'customer'` **omite `costPriceInCents`**.
 *
 * Duas barreiras, e as duas importam: as leituras do canal (`findByIdForCustomer`,
 * `listForCustomer`) selecionam só as colunas do cliente, então o custo nem sai do banco; e esta
 * função descarta o campo mesmo se receber uma linha completa, cobrindo quem chamar com o
 * resultado de um `findById` comum.
 */
export function toProduct(row: ProductRow, projection: ProductProjection = 'admin'): Product {
  const base: Product = {
    id: row.id,
    name: row.name,
    description: row.description,
    priceInCents: row.priceInCents,
    imageUrl: row.imageUrl,
    catalogId: row.catalogId,
    active: row.active,
    sortOrder: row.sortOrder,
    availability: (row.availability as ProductAvailability) ?? PRODUCT_AVAILABILITY.IN_STOCK,
    inventory: row.inventory,
    unit: row.unit,
    barcode: row.barcode,
    sectionId: row.sectionId,
    preparationTimeMinutes: row.preparationTimeMinutes,
    preparationInstructions: row.preparationInstructions,
    externalId: row.externalId,
    syncStatus: (row.syncStatus as ProductSyncStatus | null) ?? null,
    syncError: row.syncError,
  }

  if (projection === 'customer') return base
  return { ...base, costPriceInCents: row.costPriceInCents }
}

export function toCatalog(row: CatalogRow | CatalogWithCount): Catalog {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active,
    sortOrder: row.sortOrder,
    productCount: 'productCount' in row ? row.productCount : undefined,
    externalId: row.externalId,
    syncStatus: (row.syncStatus as ProductSyncStatus | null) ?? null,
    syncError: row.syncError,
  }
}

export function toSection(row: SectionRow): Section {
  return { id: row.id, name: row.name, catalogId: row.catalogId, sortOrder: row.sortOrder }
}

export function toPaginated<TRow, TItem>(params: {
  rows: readonly TRow[]
  total: number
  page: number
  pageSize: number
  map: (row: TRow) => TItem
}) {
  return {
    data: params.rows.map(params.map),
    total: params.total,
    page: params.page,
    pageSize: params.pageSize,
    // `Math.ceil` com total 0 dá 0 páginas, não 1 — a UI usa isso para decidir se desenha a
    // paginação, e "página 1 de 0" seria pior que não desenhar.
    totalPages: Math.ceil(params.total / params.pageSize),
  }
}
