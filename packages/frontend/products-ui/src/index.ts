export { ProductsWorkspace, useProductsWorkspace, DEFAULT_PRODUCTS_WORKSPACE_LABELS } from './workspace'
export type { ProductsWorkspaceProps, ProductsWorkspaceState, ProductsWorkspaceLabels, ProductDraft } from './workspace'

export { ProductList } from './ProductList'
export type { ProductListProps } from './ProductList'

export { ProductForm } from './ProductForm'
export type { ProductFormProps } from './ProductForm'

export { CatalogList, CATALOG_NONE } from './CatalogList'
export type { CatalogListProps } from './CatalogList'

export { ImageUpload } from './ImageUpload'
export type { ImageUploadProps } from './ImageUpload'

export { BulkImport } from './BulkImport'
export type { BulkImportProps } from './BulkImport'

export { useProductSearch } from './useProductSearch'
export type { UseProductSearchOptions, UseProductSearchResult } from './useProductSearch'

export {
  ProductsProvider,
  useProducts,
  useProductsConfig,
  useIsProductFieldEnabled,
} from './providers/ProductsProvider'
export type { ProductsProviderProps } from './providers/ProductsProvider'

export { formatBarcode } from './lib/format'
export { formatMoney, maskMoneyInput, applyMarginToCost, formatMarginPercent } from './lib/money'
export type { MoneyFormat } from './lib/money'

export {
  PRODUCT_OPTIONAL_FIELD,
  PRODUCT_SYNC_STATUS,
  DEFAULT_PRODUCTS_CONFIG,
  DEFAULT_UNIT_OPTIONS,
  DEFAULT_META_SYNC,
} from './providers/types'

export type {
  Product,
  Catalog,
  Section,
  ProductsApi,
  ProductsConfig,
  MetaSyncConfig,
  ProductOptionalField,
  ProductSyncStatus,
  PaginatedResponse,
  ProductSuggestion,
  CreateProductInput,
  UpdateProductInput,
  CreateCatalogInput,
  UpdateCatalogInput,
  BulkImportResult,
} from './providers/types'
