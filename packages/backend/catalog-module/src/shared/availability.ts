/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { PRODUCT_AVAILABILITY, PRODUCT_SYNC_STATUS } from '@adatechnology/catalog-contracts'
import type { CatalogModuleConfig, ProductAvailability } from '@adatechnology/catalog-contracts'

/**
 * Só deriva quando o host pediu **e** o produto controla estoque. `inventory: null` significa
 * "não controlo" — derivar ali marcaria como esgotado quem nunca teve contagem, sumindo do
 * catálogo itens que estão à venda.
 */
export function deriveAvailability(params: {
  readonly config: Pick<CatalogModuleConfig, 'deriveAvailabilityFromInventory'>
  readonly inventory: number | null | undefined
  readonly current: string
}): ProductAvailability | undefined {
  if (!params.config.deriveAvailabilityFromInventory) return undefined
  if (params.inventory === null || params.inventory === undefined) return undefined

  const next = params.inventory > 0 ? PRODUCT_AVAILABILITY.IN_STOCK : PRODUCT_AVAILABILITY.OUT_OF_STOCK
  return next === params.current ? undefined : next
}

/**
 * O evento de esgotado dispara **na transição** para zero, não a cada venda. Sem isto, um item
 * zerado geraria um alerta de reposição por pedido — e o operador aprenderia a ignorar o alerta.
 */
export function crossedIntoOutOfStock(params: { readonly before: number | null; readonly after: number }): boolean {
  if (params.before === null) return false
  return params.before > 0 && params.after === 0
}

/**
 * Campos que, alterados, exigem republicar na Meta. Mudar `preparationInstructions` (ficha
 * interna da cozinha) ou `costPriceInCents` (margem) não muda nada no que o cliente vê lá —
 * marcar `pending` nesses casos geraria fila de sync sem motivo.
 */
const META_RELEVANT_FIELDS: readonly string[] = [
  'name',
  'description',
  'priceInCents',
  'imageUrl',
  'availability',
  'active',
]

export function requiresMetaResync(changedFields: readonly string[]): boolean {
  return changedFields.some((field) => META_RELEVANT_FIELDS.includes(field))
}

export const PENDING_SYNC = PRODUCT_SYNC_STATUS.PENDING
