/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz. **Escopo da Fase 2:** devolve `{ useCases, lookup }`. Rotas HTTP e worker de
 * publicação chegam nas Fases 3 e 4 — não é forma reduzida por engano, eles genuinamente ainda
 * não existem.
 */

import { ConfigMissingError, MetaSyncDisabledError } from '@adatechnology/catalog-contracts'
import type {
  CatalogHooks,
  CatalogModuleConfig,
  CatalogProductLookup,
  ClockPort,
  LoggerPort,
  MetaCatalogSyncPort,
  ProductImageStoragePort,
  ProductSuggestionPort,
} from '@adatechnology/catalog-contracts'

import type { CatalogDatabase } from './database.types'
import { CatalogRepository } from './repositories/CatalogRepository'
import { ProductRepository } from './repositories/ProductRepository'
import { SectionRepository } from './repositories/SectionRepository'
import { toProduct } from './shared/toContract'
import { BulkImportProductsUseCase } from './use-cases/BulkImportProducts.use-case'
import type { CatalogDependencies } from './use-cases/catalogModule.types'
import {
  CreateCatalogUseCase,
  CreateSectionUseCase,
  DeleteCatalogUseCase,
  DeleteSectionUseCase,
  ListCatalogsUseCase,
  ListSectionsUseCase,
  UpdateCatalogUseCase,
  UpdateSectionUseCase,
} from './use-cases/Catalog.use-cases'
import { AdjustInventoryUseCase, ConsumeInventoryUseCase } from './use-cases/Inventory.use-cases'
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from './use-cases/Product.use-cases'

export type CatalogModuleProviders = {
  readonly imageStorage?: ProductImageStoragePort
  readonly metaSync?: MetaCatalogSyncPort
  readonly productSuggestion?: ProductSuggestionPort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
}

export type CreateCatalogModuleParams = {
  readonly db: CatalogDatabase
  readonly config: CatalogModuleConfig
  readonly providers?: CatalogModuleProviders
  readonly hooks?: CatalogHooks
}

export type CatalogModule = {
  readonly useCases: {
    readonly createProduct: CreateProductUseCase
    readonly updateProduct: UpdateProductUseCase
    readonly deleteProduct: DeleteProductUseCase
    readonly getProduct: GetProductUseCase
    readonly listProducts: ListProductsUseCase
    readonly createCatalog: CreateCatalogUseCase
    readonly updateCatalog: UpdateCatalogUseCase
    readonly deleteCatalog: DeleteCatalogUseCase
    readonly listCatalogs: ListCatalogsUseCase
    readonly createSection: CreateSectionUseCase
    readonly updateSection: UpdateSectionUseCase
    readonly deleteSection: DeleteSectionUseCase
    readonly listSections: ListSectionsUseCase
    readonly consumeInventory: ConsumeInventoryUseCase
    readonly adjustInventory: AdjustInventoryUseCase
    readonly bulkImportProducts: BulkImportProductsUseCase
  }
  /** Projeção para o canal de conversa plugar no `CatalogPort` do `meta-whatsapp-module`. */
  readonly lookup: CatalogProductLookup
}

export function createCatalogModule(params: CreateCatalogModuleParams): CatalogModule {
  if (!params.config.currency) throw new ConfigMissingError('currency')
  if (!params.config.locale) throw new ConfigMissingError('locale')

  // Feature ligada sem a porta é erro de composição, e falha no boot em vez de na primeira
  // publicação — o operador descobriria pelo item que nunca sobe, dias depois.
  const wantsMetaSync = params.config.metaSync?.products || params.config.metaSync?.catalogs
  if (wantsMetaSync && !params.providers?.metaSync) throw new MetaSyncDisabledError()

  const dependencies: CatalogDependencies = {
    products: new ProductRepository(params.db),
    catalogs: new CatalogRepository(params.db),
    sections: new SectionRepository(params.db),
    config: params.config,
    hooks: params.hooks,
    clock: params.providers?.clock,
    logger: params.providers?.logger,
    imageStorage: params.providers?.imageStorage,
    metaSync: params.providers?.metaSync,
    productSuggestion: params.providers?.productSuggestion,
  }

  const createProduct = new CreateProductUseCase(dependencies)
  const consumeInventory = new ConsumeInventoryUseCase(dependencies)

  return {
    useCases: {
      createProduct,
      updateProduct: new UpdateProductUseCase(dependencies),
      deleteProduct: new DeleteProductUseCase(dependencies),
      getProduct: new GetProductUseCase(dependencies),
      listProducts: new ListProductsUseCase(dependencies),
      createCatalog: new CreateCatalogUseCase(dependencies),
      updateCatalog: new UpdateCatalogUseCase(dependencies),
      deleteCatalog: new DeleteCatalogUseCase(dependencies),
      listCatalogs: new ListCatalogsUseCase(dependencies),
      createSection: new CreateSectionUseCase(dependencies),
      updateSection: new UpdateSectionUseCase(dependencies),
      deleteSection: new DeleteSectionUseCase(dependencies),
      listSections: new ListSectionsUseCase(dependencies),
      consumeInventory,
      adjustInventory: new AdjustInventoryUseCase(dependencies),
      bulkImportProducts: new BulkImportProductsUseCase(dependencies, createProduct),
    },

    lookup: {
      async findByRetailerId({ companyId, retailerId }) {
        // `retailerId` na Meta é o id do produto aqui — é o que o `SyncProductToMeta` envia.
        const row = await dependencies.products.findById({ companyId, id: retailerId })
        // Projeção de cliente: o canal de conversa fala com o comprador, e custo não vai junto.
        return row ? toProduct(row, 'customer') : undefined
      },

      async listForChannel({ companyId, search }) {
        const page = await dependencies.products.list({
          companyId,
          page: 1,
          pageSize: 30,
          search,
          active: true,
        })
        return page.rows.map((row) => toProduct(row, 'customer'))
      },

      async consumeInventory({ companyId, productId, quantity }) {
        await consumeInventory.execute({ companyId, productId, quantity })
      },
    },
  }
}
