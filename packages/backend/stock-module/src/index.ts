/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createStockModule } from './StockModule'
export type { StockModule, StockModuleProviders, CreateStockModuleParams } from './StockModule'

export { createStockRoutes } from './http/routes'
export type { CreateStockRoutesParams } from './http/routes'

export { runStockMigrations, stockMigrationsFolder, STOCK_MIGRATIONS_TABLE } from './runMigrations'
export type { RunStockMigrationsParams } from './runMigrations'
export type { StockDatabase, DrizzleMigrateFunction } from './database.types'

export {
  stockSchema,
  levels,
  batches,
  movements,
  deductions,
  inventoryCounts,
  inventoryCountLines,
} from './schema/schema'
export type {
  LevelRow,
  BatchRow,
  NewBatchRow,
  MovementRow,
  NewMovementRow,
  InventoryCountRow,
  InventoryCountLineRow,
} from './schema/schema'

export { createDrizzleStockPersistence } from './repositories/createDrizzleStockPersistence'
export type {
  StockPersistence,
  StockStorePort,
  StockTransaction,
  InventoryStorePort,
  InventoryRecord,
  InventorySummaryRow,
  StockDependencies,
  Page,
} from './use-cases/stockModule.types'

export {
  GetStockLevelsUseCase,
  GetStockLevelUseCase,
  ListStockLevelsUseCase,
  SetMinimumUseCase,
} from './use-cases/Level.use-cases'
export {
  ReceiveBatchUseCase,
  AdjustStockUseCase,
  RecordLossUseCase,
  ListMovementsUseCase,
  ListBatchesUseCase,
} from './use-cases/Movement.use-cases'
export { DeductOrderUseCase, orderLineSourceKey } from './use-cases/Deduction.use-cases'
export {
  OpenInventoryUseCase,
  GetInventoryUseCase,
  ListInventoriesUseCase,
  RecordCountsUseCase,
  ApplyInventoryUseCase,
  CancelInventoryUseCase,
} from './use-cases/Inventory.use-cases'
export { ScanExpiringBatchesUseCase } from './use-cases/Expiry.use-cases'
export type { ScanExpiringBatchesResult } from './use-cases/Expiry.use-cases'

export { createInMemoryStockPersistence } from './testing/inMemoryPersistence'
export type { InMemoryStockState } from './testing/inMemoryPersistence'
