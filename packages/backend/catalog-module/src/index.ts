/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fases 1 e 2: dados + comportamento. Rotas HTTP e worker de publicação chegam nas Fases 3 e 4.
 */

export type { CatalogDatabase, DrizzleMigrateFunction } from './database.types'

export { catalogSchema, catalogs, sections, products } from './schema/schema'
export type { CatalogRow, NewCatalogRow, SectionRow, NewSectionRow, ProductRow, NewProductRow } from './schema/schema'

export { runCatalogMigrations, catalogMigrationsFolder, CATALOG_MIGRATIONS_TABLE } from './runMigrations'
export type { RunCatalogMigrationsParams } from './runMigrations'

export {
  productOwnedByCondition,
  productListCondition,
  productSearchCondition,
  catalogOwnedByCondition,
  catalogListCondition,
  sectionOwnedByCondition,
  sectionListCondition,
} from './repositories/conditions'

export { ProductRepository, CUSTOMER_FACING_PRODUCT_COLUMNS } from './repositories/ProductRepository'
export type { ListProductsQuery, ListProductsPage } from './repositories/ProductRepository'

export { CatalogRepository } from './repositories/CatalogRepository'
export type { ListCatalogsQuery, CatalogWithCount } from './repositories/CatalogRepository'

export { SectionRepository } from './repositories/SectionRepository'

export { createCatalogModule } from './CatalogModule'
export type { CatalogModule, CreateCatalogModuleParams, CatalogModuleProviders } from './CatalogModule'

export {
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
} from './use-cases/Product.use-cases'
export {
  CreateCatalogUseCase,
  UpdateCatalogUseCase,
  DeleteCatalogUseCase,
  ListCatalogsUseCase,
  CreateSectionUseCase,
  UpdateSectionUseCase,
  DeleteSectionUseCase,
  ListSectionsUseCase,
} from './use-cases/Catalog.use-cases'
export { ConsumeInventoryUseCase, AdjustInventoryUseCase } from './use-cases/Inventory.use-cases'
export { BulkImportProductsUseCase } from './use-cases/BulkImportProducts.use-case'
export type { BulkImportParams } from './use-cases/BulkImportProducts.use-case'
export type { CatalogDependencies } from './use-cases/catalogModule.types'

export { deriveAvailability, crossedIntoOutOfStock, requiresMetaResync } from './shared/availability'
export { parsePriceToCents } from './shared/parsePrice'
export type { ParsePriceResult } from './shared/parsePrice'
export { toProduct, toCatalog, toSection, toPaginated } from './shared/toContract'
export type { ProductProjection } from './shared/toContract'
