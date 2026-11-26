/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  CATALOG_EVENT,
  DuplicateBarcodeError,
  ProductNotFoundError,
  type AvailabilitySchedule,
  type CreateProductInput,
  type PaginatedResponse,
  type Product,
  type UpdateProductInput,
} from '@adatechnology/catalog-contracts'

import type { ListProductsQuery } from '../repositories/ProductRepository'
import {
  deriveAvailability,
  evaluateProductAvailability,
  PENDING_SYNC,
  requiresMetaResync,
  type ProductAvailabilityVerdict,
} from '../shared/availability'
import { toPaginated, toProduct, type ProductProjection } from '../shared/toContract'
import { nowOf, runHook, type CatalogDependencies } from './catalogModule.types'

export class CreateProductUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(params: { companyId: string } & CreateProductInput): Promise<Product> {
    await validateAttributes({
      dependencies: this.dependencies,
      companyId: params.companyId,
      attributes: params.attributes,
    })

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
      brand: params.brand,
      unitSize: params.unitSize,
      aisle: params.aisle,
      ...(params.aliases ? { aliases: [...params.aliases] } : {}),
      barcode: params.barcode,
      imageUrl: params.imageUrl,
      inventory: params.inventory,
      sortOrder: params.sortOrder,
      preparationTimeMinutes: params.preparationTimeMinutes,
      preparationInstructions: params.preparationInstructions,
      ...(params.availabilitySchedule
        ? { availabilitySchedule: params.availabilitySchedule as AvailabilitySchedule }
        : {}),
      ...(params.attributes ? { attributes: { ...params.attributes } } : {}),
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
    const { companyId, id, ...changes } = params

    const current = await this.dependencies.products.findById({ companyId, id })
    if (!current) throw new ProductNotFoundError(id)

    await validateAttributes({ dependencies: this.dependencies, companyId, attributes: changes.attributes })

    if (changes.barcode && changes.barcode !== current.barcode) {
      const existing = await this.dependencies.products.findByBarcode({ companyId, barcode: changes.barcode })
      if (existing && existing.id !== id) throw new DuplicateBarcodeError(changes.barcode)
    }

    const availability = deriveAvailability({
      config: this.dependencies.config,
      inventory: changes.inventory ?? current.inventory,
      current: current.availability,
    })

    const { aliases, attributes, availabilitySchedule, ...rest } = changes
    const changedFields = Object.keys(changes).filter((field) => changes[field as keyof typeof changes] !== undefined)
    if (availability) changedFields.push('availability')

    const row = await this.dependencies.products.update({
      companyId,
      id,
      values: {
        ...rest,
        // `aliases` chega `readonly` do contrato e o Drizzle escreve array mutavel. Sai do spread
        // e volta copiado: e o unico ponto onde a fronteira dos dois tipos se resolve.
        ...(aliases ? { aliases: [...aliases] } : {}),
        // `null` limpa a agenda; ausente não mexe.
        ...(availabilitySchedule === undefined
          ? {}
          : { availabilitySchedule: availabilitySchedule as AvailabilitySchedule | null }),
        ...(attributes ? { attributes: { ...attributes } } : {}),
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

async function validateAttributes(params: {
  readonly dependencies: CatalogDependencies
  readonly companyId: string
  readonly attributes: Readonly<Record<string, unknown>> | undefined
}): Promise<void> {
  if (!params.attributes) return
  // Sem catch: o host escolhe a classe de erro e o status; o módulo só deixa propagar.
  await params.dependencies.attributesValidator?.validate({
    companyId: params.companyId,
    attributes: params.attributes,
  })
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
    const catalogIds = [...new Set(page.rows.flatMap((row) => (row.catalogId ? [row.catalogId] : [])))]
    // Uma consulta para a página inteira, não uma por produto: a lista mostra o nome do catálogo.
    const catalogNames = new Map(
      (await this.dependencies.catalogs.findNamesByIds({ companyId: query.companyId, ids: catalogIds })).map(
        (catalog) => [catalog.id, catalog.name] as const,
      ),
    )
    // Seção é lista curta por natureza (ver `SectionRepository.listByCompany`): uma leitura cobre a página.
    const sectionNames = new Map(
      (await this.dependencies.sections.listByCompany({ companyId: query.companyId })).map(
        (section) => [section.id, section.name] as const,
      ),
    )
    return toPaginated({
      rows: page.rows,
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      map: (row) => {
        const product = toProduct(row, query.projection)
        const catalogName = row.catalogId ? catalogNames.get(row.catalogId) : undefined
        const sectionName = row.sectionId ? sectionNames.get(row.sectionId) : undefined
        return {
          ...product,
          ...(catalogName === undefined ? {} : { catalogName }),
          ...(sectionName === undefined ? {} : { sectionName }),
        }
      },
    })
  }
}

export class IsProductAvailableUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  /** `at` ausente = agora (relógio injetado). */
  async execute(params: { companyId: string; id: string; at?: Date }): Promise<ProductAvailabilityVerdict> {
    const row = await this.dependencies.products.findById({ companyId: params.companyId, id: params.id })
    if (!row) throw new ProductNotFoundError(params.id)

    return evaluateProductAvailability({
      row,
      at: params.at ?? nowOf(this.dependencies),
      defaultTimeZone: this.dependencies.config.defaultTimeZone,
    })
  }
}

/** Teto de leitura por consulta; cardápio/catálogo que passa disso deve filtrar por seção. */
const AVAILABLE_PRODUCTS_LIMIT = 1000

export class ListAvailableProductsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  /** Produtos vendáveis em `at` (padrão: agora), no escopo de catálogo/seção pedido. */
  async execute(params: {
    companyId: string
    at?: Date
    catalogId?: string
    sectionId?: string
    projection?: ProductProjection
  }): Promise<Product[]> {
    const at = params.at ?? nowOf(this.dependencies)
    const rows = await this.dependencies.products.listActive({
      companyId: params.companyId,
      catalogId: params.catalogId,
      sectionId: params.sectionId,
      limit: AVAILABLE_PRODUCTS_LIMIT,
    })

    return rows
      .filter(
        (row) =>
          evaluateProductAvailability({ row, at, defaultTimeZone: this.dependencies.config.defaultTimeZone }).available,
      )
      .map((row) => toProduct(row, params.projection))
  }
}
