/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estoque. A atomicidade de verdade mora em `ProductRepository.consumeInventory` (o `UPDATE ...
 * WHERE inventory >= quantity`); aqui fica o que vem depois dela: derivar disponibilidade,
 * disparar o evento de esgotado na transição e reenfileirar a publicação.
 */

import { CATALOG_EVENT, PRODUCT_AVAILABILITY, ProductNotFoundError } from '@adatechnology/catalog-contracts'
import type { Product } from '@adatechnology/catalog-contracts'

import { crossedIntoOutOfStock, PENDING_SYNC } from '../shared/availability'
import { toProduct } from '../shared/toContract'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

export class ConsumeInventoryUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  /**
   * Chamado ao fechar pedido — inclusive pelo canal de conversa, via `CatalogProductLookup`.
   * Lança `InsufficientInventoryError` quando não há saldo; é o repositório que decide isso, na
   * mesma instrução que desconta.
   */
  async execute(params: { companyId: string; productId: string; quantity: number }): Promise<void> {
    const before = await this.dependencies.products.findById({ companyId: params.companyId, id: params.productId })
    if (!before) throw new ProductNotFoundError(params.productId)

    const { remaining } = await this.dependencies.products.consumeInventory({
      companyId: params.companyId,
      id: params.productId,
      quantity: params.quantity,
    })

    // `Infinity` = produto sem controle de estoque; não há disponibilidade a derivar nem evento
    // a disparar.
    if (!Number.isFinite(remaining)) return

    const justRanOut = crossedIntoOutOfStock({ before: before.inventory, after: remaining })
    if (!justRanOut) return

    if (this.dependencies.config.deriveAvailabilityFromInventory) {
      await this.dependencies.products.update({
        companyId: params.companyId,
        id: params.productId,
        values: {
          availability: PRODUCT_AVAILABILITY.OUT_OF_STOCK,
          // Item esgotado precisa sumir da vitrine da Meta também, senão o cliente pede o que
          // não existe.
          ...(this.dependencies.config.metaSync?.products ? { syncStatus: PENDING_SYNC } : {}),
        },
      })
    }

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.PRODUCT_OUT_OF_STOCK,
      run: () =>
        this.dependencies.hooks?.onProductOutOfStock?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          productId: params.productId,
          name: before.name,
        }),
    })
  }
}

export class AdjustInventoryUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  /**
   * Ajuste manual do operador (contagem, recebimento, perda). Absoluto e não incremental de
   * propósito: contagem de prateleira produz "tenho 12", não "somei 3" — e um incremento aplicado
   * duas vezes por duplo clique daria número errado sem ninguém perceber.
   */
  async execute(params: { companyId: string; productId: string; inventory: number | null }): Promise<Product> {
    const before = await this.dependencies.products.findById({ companyId: params.companyId, id: params.productId })
    if (!before) throw new ProductNotFoundError(params.productId)

    const availability =
      this.dependencies.config.deriveAvailabilityFromInventory && params.inventory !== null
        ? params.inventory > 0
          ? PRODUCT_AVAILABILITY.IN_STOCK
          : PRODUCT_AVAILABILITY.OUT_OF_STOCK
        : undefined

    const row = await this.dependencies.products.update({
      companyId: params.companyId,
      id: params.productId,
      values: {
        inventory: params.inventory,
        ...(availability ? { availability } : {}),
        ...(this.dependencies.config.metaSync?.products && availability && availability !== before.availability
          ? { syncStatus: PENDING_SYNC }
          : {}),
      },
    })
    if (!row) throw new ProductNotFoundError(params.productId)

    if (crossedIntoOutOfStock({ before: before.inventory, after: params.inventory ?? -1 })) {
      await runHook({
        dependencies: this.dependencies,
        name: CATALOG_EVENT.PRODUCT_OUT_OF_STOCK,
        run: () =>
          this.dependencies.hooks?.onProductOutOfStock?.({
            companyId: params.companyId,
            occurredAt: nowOf(this.dependencies),
            productId: params.productId,
            name: row.name,
          }),
      })
    }

    return toProduct(row)
  }
}
