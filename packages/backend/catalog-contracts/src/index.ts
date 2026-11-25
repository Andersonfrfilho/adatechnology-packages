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
  productAttributesSchema,
  availableProductsQuerySchema,
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
  AvailableProductsQuery,
} from './schemas'

export type {
  ProductImageStoragePort,
  ProductAttributesValidatorPort,
  MetaProductPayload,
  MetaSyncOutcome,
  MetaCatalogSyncPort,
  ProductSuggestionPort,
  ProductVisionPort,
  ProductVisionReading,
  ProductVisionCandidate,
  ProductVisionRanking,
  ClockPort,
  LoggerPort,
  LogMeta,
  CatalogModuleConfig,
  CatalogProductLookup,
  CatalogWebhookConfig,
  WebhookNonceStorePort,
} from './providers'

export {
  WEEKDAY,
  WEEKDAYS,
  DEFAULT_SCHEDULE_TIME_ZONE,
  availabilityScheduleSchema,
  isAvailableAt,
  isValidTimeZone,
  localTimeParts,
} from './availabilitySchedule'
export type { AvailabilitySchedule, Weekday } from './availabilitySchedule'

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
  ProductImageUnmatchedEvent,
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
  VisionDisabledError,
  VisionModelMismatchError,
  VisionDimensionsMismatchError,
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
