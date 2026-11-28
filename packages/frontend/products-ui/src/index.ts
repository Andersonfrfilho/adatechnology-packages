export {
  ProductsWorkspace,
  useProductsWorkspace,
  DEFAULT_PRODUCTS_WORKSPACE_LABELS,
  PRODUCTS_WORKSPACE_AREA,
  isProductsWorkspaceArea,
} from './workspace'
export type {
  ProductsWorkspaceProps,
  ProductsWorkspaceState,
  ProductsWorkspaceLabels,
  ProductDraft,
  ProductsWorkspaceArea,
} from './workspace'

export { ProductList } from './ProductList'
export type { ProductListProps } from './ProductList'

export { ProductForm } from './ProductForm'
export type { ProductFormProps } from './ProductForm'

export { CatalogList, CATALOG_NONE } from './CatalogList'
export type { CatalogListProps } from './CatalogList'

export { ImageUpload } from './ImageUpload'
export type { ImageUploadProps } from './ImageUpload'
export { compressImage, PRODUCT_IMAGE_MAX_BYTES } from './compressImage'
export type { CompressImageParams } from './compressImage'
/*
  Reexportado, e nao removido: o recorte mudou de casa para `@adatechnology/image-cutout`, e quem ja
  importava daqui nao precisa saber disso. Tirar seria quebra em versao de correcao.
*/
export { removeBackground, BACKGROUND_FILL } from '@adatechnology/image-cutout'
export type { BackgroundFill, BackgroundRemovalConfig, RemoveBackgroundParams } from '@adatechnology/image-cutout'

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

export { AvailabilityScheduleEditor } from './AvailabilityScheduleEditor'
export type {
  AvailabilityScheduleEditorProps,
  AvailabilityScheduleDraft,
  RenderTimeInput,
  TimeInputProps,
} from './AvailabilityScheduleEditor'
export { OrderEligibilitySection } from './OrderEligibilitySection'
export type { OrderEligibilitySectionProps } from './OrderEligibilitySection'
export { DEFAULT_ORDER_ELIGIBILITY_LABELS } from './lib/orderEligibility'
export type { OrderEligibilityLabels } from './lib/orderEligibility'
export { AttributesEditor } from './AttributesEditor'
export type { AttributesEditorProps } from './AttributesEditor'

export { formatBarcode } from './lib/format'
export { formatMoney, maskMoneyInput, applyMarginToCost, formatMarginPercent } from './lib/money'
export type { MoneyFormat } from './lib/money'

export {
  PRODUCT_OPTIONAL_FIELD,
  ORDER_AUDIENCE,
  PRODUCT_SYNC_STATUS,
  DEFAULT_PRODUCTS_CONFIG,
  DEFAULT_UNIT_OPTIONS,
  DEFAULT_META_SYNC,
  WEEKDAYS,
} from './providers/types'

export type {
  Product,
  Catalog,
  Section,
  ProductsApi,
  ProductsConfig,
  MetaSyncConfig,
  ProductOptionalField,
  OrderAudience,
  ProductOrderEligibility,
  ProductSyncStatus,
  AvailabilitySchedule,
  Weekday,
  PaginatedResponse,
  ProductSuggestion,
  CreateProductInput,
  UpdateProductInput,
  CreateCatalogInput,
  UpdateCatalogInput,
  BulkImportResult,
} from './providers/types'

export {
  createCatalogModuleProductsApi,
  CatalogModuleApiError,
  CATALOG_MODULE_DEFAULT_PAGE_SIZE,
} from './providers/createCatalogModuleProductsApi'
export type { CreateCatalogModuleProductsApiParams } from './providers/createCatalogModuleProductsApi'
export { parseBulkImportCsv } from './lib/csv'

export { DEFAULT_PRODUCTS_LISTING_LABELS } from './listing/listing.labels'
export type { ProductsListingLabels } from './listing/listing.labels'
export {
  PRODUCT_AVAILABILITY_FILTER,
  PRODUCT_PRICING_FILTER,
  PRODUCTS_PER_PAGE_OPTIONS,
  PRODUCTS_DEFAULT_PER_PAGE,
} from './listing/listing.types'
export type {
  ProductsListQuery,
  ProductsListingOptions,
  ProductsSelectOption,
  ProductsSelectRenderProps,
  ProductsMultiSelectRenderProps,
  ProductsSearchRenderProps,
  ProductsExportContext,
} from './listing/listing.types'
export {
  DEFAULT_PRODUCTS_LIST_QUERY,
  PRODUCTS_LIST_QUERY_KEYS,
  parseProductsListQuery,
  serializeProductsListQuery,
  toListProductsParams,
} from './listing/listQuery'
export type { ProductsListQueryKey } from './listing/listQuery'
export { PRODUCT_SORT_FIELD, PRODUCT_FILTER_NONE } from './providers/types'
export type { ProductSortField, SortDirection, ListProductsParams, ProductsBatchResult } from './providers/types'
