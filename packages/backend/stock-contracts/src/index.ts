/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { MOVEMENT_KIND, MOVEMENT_KINDS, INVENTORY_STATUS, DEDUCTION_STATUS } from './stock.types'
export type {
  MovementKind,
  InventoryStatus,
  DeductionStatus,
  StockLevelView,
  StockBatch,
  StockMovement,
  InventoryCount,
  InventoryCountLine,
  InventoryCountSummary,
  OrderLineDeduction,
  OrderDeductionResult,
  ExpiringBatch,
} from './stock.types'

export {
  STOCK_LIMITS,
  ADJUST_DIRECTION,
  receiveBatchSchema,
  adjustStockSchema,
  recordLossSchema,
  setMinimumSchema,
  orderLineSchema,
  deductOrderSchema,
  listLevelsQuerySchema,
  listMovementsQuerySchema,
  listBatchesQuerySchema,
  openInventorySchema,
  recordCountsSchema,
  listInventoriesQuerySchema,
  stockLevelsLookupSchema,
} from './schemas'
export type {
  AdjustDirection,
  ReceiveBatchInput,
  ReceiveBatchData,
  AdjustStockInput,
  AdjustStockData,
  RecordLossInput,
  RecordLossData,
  SetMinimumData,
  DeductOrderInput,
  DeductOrderData,
  ListLevelsQuery,
  ListMovementsQuery,
  ListBatchesQuery,
  OpenInventoryData,
  RecordCountsData,
  ListInventoriesQuery,
  StockLevelsLookupData,
} from './schemas'

export {
  StockError,
  STOCK_ERROR_CODES,
  StockDisabledError,
  StockIngredientNotFoundError,
  StockBatchNotFoundError,
  StockIncompatibleUnitError,
  InsufficientBatchError,
  InventoryNotFoundError,
  InventoryClosedError,
  InventoryAlreadyOpenError,
  StockConfigMissingError,
  StockUnauthenticatedError,
} from './errors'

export { DEFAULT_STOCK_SCOPES } from './providers'
export type {
  StockIngredient,
  IngredientCatalogPort,
  RecipeSourcePort,
  BelowMinimumEvent,
  StockHooks,
  StockScopes,
  StockModuleConfig,
} from './providers'

export { planFefoConsumption } from './fefo'
export type { FefoBatch, FefoAllocation, FefoPlan } from './fefo'
