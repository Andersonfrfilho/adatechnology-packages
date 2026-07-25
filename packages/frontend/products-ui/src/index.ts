export { ProductList } from './ProductList'
export type { ProductListProps } from './ProductList'

export { ProductForm } from './ProductForm'
export type { ProductFormProps } from './ProductForm'

export { CatalogList } from './CatalogList'
export type { CatalogListProps } from './CatalogList'

export { ImageUpload } from './ImageUpload'
export type { ImageUploadProps } from './ImageUpload'

export { BulkImport } from './BulkImport'
export type { BulkImportProps } from './BulkImport'

export { useProductSearch } from './useProductSearch'
export type { UseProductSearchOptions, UseProductSearchResult } from './useProductSearch'

export { ProductsProvider, useProducts } from './providers/ProductsProvider'
export type { ProductsProviderProps } from './providers/ProductsProvider'

export { formatBRL, formatMargin, formatBarcode, parseCurrency } from './lib/format'

export type {
  Product,
  Catalog,
  Section,
  ProductsApi,
  PaginatedResponse,
  CreateProductInput,
  UpdateProductInput,
  CreateCatalogInput,
  UpdateCatalogInput,
  BulkImportResult,
} from './providers/types'
