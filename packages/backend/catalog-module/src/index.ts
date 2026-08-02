/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Fase 1 do `catalog-module`: dados. Use-cases, HTTP e sync com a Meta chegam nas Fases 2–4.
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
