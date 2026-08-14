/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CATALOG_EVENT,
  DuplicateBarcodeError,
  ProductNotFoundError,
  type CreateProductInput,
  type PaginatedResponse,
  type Product,
  type UpdateProductInput,
} from '@adatechnology/catalog-contracts'

import type { ListProductsQuery } from '../repositories/ProductRepository'
import { deriveAvailability, PENDING_SYNC, requiresMetaResync } from '../shared/availability'
import { toPaginated, toProduct, type ProductProjection } from '../shared/toContract'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

export class CreateProductUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string } & CreateProductInput): Promise<Product> {
    if (params.barcode) {
      const existing = await this.dependencies.products.findByBarcode({
        companyId: params.companyId,
        barcode: params.barcode,
      })
      if (existing) throw new DuplicateBarcodeError(params.barcode)
    }

    const availability = deriveAvailability({
      config: this.dependencies.config,
      inventory: params.inventory,
      current: '',
    })

    const row = await this.dependencies.products.create({
      companyId: params.companyId,
      catalogId: params.catalogId,
      sectionId: params.sectionId,
      name: params.name,
      description: params.description,
      priceInCents: params.priceInCents,
      costPriceInCents: params.costPriceInCents,
      unit: params.unit,
      unitSize: params.unitSize,
      brand: params.brand,
      aisle: params.aisle,
      // `aliases` é NOT NULL no banco; ausente vira lista vazia, e não `null`.
      ...(params.aliases ? { aliases: [...params.aliases] } : {}),
      barcode: params.barcode,
      imageUrl: params.imageUrl,
      inventory: params.inventory,
      sortOrder: params.sortOrder,
      preparationTimeMinutes: params.preparationTimeMinutes,
      preparationInstructions: params.preparationInstructions,
      ...(availability ? { availability } : {}),
      // Publicar nunca bloqueia o salvamento: nasce `pending` e o worker leva. Graph API fora do
      // ar não pode impedir cadastro de produto.
      ...(this.dependencies.config.metaSync?.products ? { syncStatus: PENDING_SYNC } : {}),
    })

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.PRODUCT_CREATED,
      run: () =>
        this.dependencies.hooks?.onProductCreated?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          productId: row.id,
          name: row.name,
        }),
    })

    return toProduct(row)
  }
}

export class UpdateProductUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string } & UpdateProductInput): Promise<Product> {
    // `aliases` sai do resto porque chega readonly do contrato e o Drizzle escreve num array
    // mutável; deixá-lo no spread contaminaria o tipo do `set` inteiro.
    const { companyId, id, aliases, ...changes } = params

    const current = await this.dependencies.products.findById({ companyId, id })
    if (!current) throw new ProductNotFoundError(id)

    if (changes.barcode && changes.barcode !== current.barcode) {
      const existing = await this.dependencies.products.findByBarcode({ companyId, barcode: changes.barcode })
      if (existing && existing.id !== id) throw new DuplicateBarcodeError(changes.barcode)
    }

    const availability = deriveAvailability({
      config: this.dependencies.config,
      inventory: changes.inventory ?? current.inventory,
      current: current.availability,
    })

    const changedFields = Object.keys(changes).filter((field) => changes[field as keyof typeof changes] !== undefined)
    if (aliases) changedFields.push('aliases')
    if (availability) changedFields.push('availability')

    const row = await this.dependencies.products.update({
      companyId,
      id,
      values: {
        ...changes,
        ...(aliases ? { aliases: [...aliases] } : {}),
        ...(availability ? { availability } : {}),
        // Só reenfileira quando mudou algo que a Meta enxerga — alterar ficha da cozinha ou custo
        // não muda nada lá, e marcar `pending` geraria fila de sync sem motivo.
        ...(this.dependencies.config.metaSync?.products && requiresMetaResync(changedFields)
          ? { syncStatus: PENDING_SYNC }
          : {}),
      },
    })
    if (!row) throw new ProductNotFoundError(id)

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.PRODUCT_UPDATED,
      run: () =>
        this.dependencies.hooks?.onProductUpdated?.({
          companyId,
          occurredAt: nowOf(this.dependencies),
          productId: id,
          // Só os NOMES dos campos — valor de custo e margem não viajam em evento.
          changedFields,
        }),
    })

    return toProduct(row)
  }
}

export class DeleteProductUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string }): Promise<void> {
    const current = await this.dependencies.products.findById(params)
    if (!current) throw new ProductNotFoundError(params.id)

    // Soft delete: pedido histórico referencia produto, e apagar de verdade perderia o nome do
    // item vendido.
    await this.dependencies.products.softDelete(params)

    // Despublicar da Meta é responsabilidade do worker, não desta chamada — mas o produto some da
    // vitrine na hora, porque as leituras já filtram `deletedAt`.
    if (this.dependencies.config.metaSync?.products && current.externalId && this.dependencies.metaSync) {
      await this.dependencies.metaSync.deleteProduct(current.externalId).catch((error: unknown) => {
        this.dependencies.logger?.warn('catalog.meta_unpublish_failed', { productId: params.id, error: String(error) })
      })
    }

    await runHook({
      dependencies: this.dependencies,
      name: CATALOG_EVENT.PRODUCT_DELETED,
      run: () =>
        this.dependencies.hooks?.onProductDeleted?.({
          companyId: params.companyId,
          occurredAt: nowOf(this.dependencies),
          productId: params.id,
        }),
    })
  }
}

export class GetProductUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string; id: string; projection?: ProductProjection }): Promise<Product> {
    const row = await this.dependencies.products.findById(params)
    if (!row) throw new ProductNotFoundError(params.id)
    return toProduct(row, params.projection)
  }
}

export class ListProductsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(query: ListProductsQuery & { projection?: ProductProjection }): Promise<PaginatedResponse<Product>> {
    const page = await this.dependencies.products.list(query)
    return toPaginated({
      rows: page.rows,
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      map: (row) => toProduct(row, query.projection),
    })
  }
}
