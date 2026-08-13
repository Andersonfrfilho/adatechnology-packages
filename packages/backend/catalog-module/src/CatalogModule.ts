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
  RecordMetaReviewVerdictUseCase,
  RetryFailedSyncsUseCase,
  SyncCatalogToMetaUseCase,
  SyncPendingToMetaUseCase,
  SyncProductToMetaUseCase,
} from './use-cases/MetaSync.use-cases'
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

export type CatalogSchedule = {
  readonly name: string
  readonly cronExpression: string
  /** Recebe a empresa: o módulo não conhece a lista de empresas do host. */
  run(companyId: string): Promise<void>
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
    readonly syncProductToMeta: SyncProductToMetaUseCase
    readonly syncCatalogToMeta: SyncCatalogToMetaUseCase
    readonly syncPendingToMeta: SyncPendingToMetaUseCase
    readonly retryFailedSyncs: RetryFailedSyncsUseCase
    readonly recordMetaReviewVerdict: RecordMetaReviewVerdictUseCase
  }
  /** Descritores para o cron do host registrar; o módulo não abre timer próprio. */
  readonly schedules: readonly CatalogSchedule[]
  /** Projeção para o canal de conversa plugar no `CatalogPort` do `meta-whatsapp-module`. */
  readonly lookup: CatalogProductLookup
}

/** Teto da listagem do canal: lista interativa de WhatsApp não comporta mais que isso. */
const CHANNEL_PRODUCT_LIMIT = 30

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
  const syncProductToMeta = new SyncProductToMetaUseCase(dependencies)
  const syncPendingToMeta = new SyncPendingToMetaUseCase(dependencies, syncProductToMeta)

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
      syncProductToMeta,
      syncCatalogToMeta: new SyncCatalogToMetaUseCase(dependencies),
      syncPendingToMeta,
      retryFailedSyncs: new RetryFailedSyncsUseCase(dependencies),
      recordMetaReviewVerdict: new RecordMetaReviewVerdictUseCase(dependencies),
    },

    schedules: wantsMetaSync
      ? [
          {
            name: 'catalog:sync-pending',
            // A cada 5 min: o intervalo do cron É o backoff do `retriable`, e catálogo tolera
            // essa latência. Um minuto só gastaria chamada da Graph API à toa.
            cronExpression: '*/5 * * * *',
            run: (companyId: string) => syncPendingToMeta.execute({ companyId }).then(() => undefined),
          },
        ]
      : [],

    lookup: {
      async findByRetailerId({ companyId, retailerId }) {
        // `retailerId` na Meta é o id do produto aqui — é o que o `SyncProductToMeta` envia.
        // `findByIdForCustomer` seleciona só as colunas do cliente: o custo nem sai do banco.
        const row = await dependencies.products.findByIdForCustomer({ companyId, id: retailerId })
        return row ? toProduct(row as never, 'customer') : undefined
      },

      async listForChannel({ companyId, search }) {
        const rows = await dependencies.products.listForCustomer({ companyId, search, limit: CHANNEL_PRODUCT_LIMIT })
        return rows.map((row) => toProduct(row as never, 'customer'))
      },

      async consumeInventory({ companyId, productId, quantity }) {
        await consumeInventory.execute({ companyId, productId, quantity })
      },
    },
  }
}
