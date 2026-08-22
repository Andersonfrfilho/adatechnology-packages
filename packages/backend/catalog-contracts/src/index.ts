/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { PRODUCT_SYNC_STATUS, PRODUCT_AVAILABILITY, DEFAULT_META_SYNC } from './catalog.types'
export type {
  CatalogId,
  ProductId,
  SectionId,
  CompanyId,
  ProductSyncStatus,
  ProductAvailability,
  Product,
  Catalog,
  Section,
  PaginatedResponse,
  CreateProductInput,
  UpdateProductInput,
  CreateCatalogInput,
  UpdateCatalogInput,
  CreateSectionInput,
  UpdateSectionInput,
  ListProductsParams,
  ListCatalogsParams,
  BulkImportRowError,
  BulkImportResult,
  MetaSyncConfig,
} from './catalog.types'

export {
  createProductSchema,
  updateProductSchema,
  createCatalogSchema,
  updateCatalogSchema,
  createSectionSchema,
  updateSectionSchema,
  listProductsQuerySchema,
  listCatalogsQuerySchema,
  bulkImportRowSchema,
} from './schemas'
export type {
  CreateProductBody,
  UpdateProductBody,
  CreateCatalogBody,
  UpdateCatalogBody,
  CreateSectionBody,
  UpdateSectionBody,
  ListProductsQuery,
  ListCatalogsQuery,
  BulkImportRow,
} from './schemas'

export type {
  ProductImageStoragePort,
  MetaProductPayload,
  MetaSyncOutcome,
  MetaCatalogSyncPort,
  ProductSuggestionPort,
  ClockPort,
  LoggerPort,
  LogMeta,
  CatalogModuleConfig,
  CatalogProductLookup,
  CatalogWebhookConfig,
  WebhookNonceStorePort,
} from './providers'

export { CATALOG_EVENT } from './events'
export type {
  CatalogEvent,
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductDeletedEvent,
  ProductOutOfStockEvent,
  CatalogCreatedEvent,
  CatalogDeletedEvent,
  SyncSucceededEvent,
  SyncFailedEvent,
  BulkImportFinishedEvent,
  CatalogHooks,
} from './events'

export {
  CatalogError,
  CATALOG_ERROR_CODES,
  ProductNotFoundError,
  CatalogNotFoundError,
  SectionNotFoundError,
  DuplicateBarcodeError,
  CatalogNotEmptyError,
  InsufficientInventoryError,
  MetaSyncDisabledError,
  InvalidImportFileError,
  ConfigMissingError,
  InvalidProductImageError,
  ImageStorageDisabledError,
  InvalidCatalogWebhookSignatureError,
  CatalogWebhookNotConfiguredError,
} from './errors'

export { catalogWebhookChangeSchema, catalogWebhookEntrySchema, catalogWebhookEnvelopeSchema } from './webhook.types'
export type {
  CatalogWebhookEnvelope,
  CatalogWebhookChange,
  CatalogWebhookEvent,
  UnhandledCatalogWebhookEventDescriptor,
  ReceiveCatalogWebhookResult,
} from './webhook.types'
