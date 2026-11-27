/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo de estoque (opcional, ligado por empresa). Insumos e fichas vêm do
 * `recipe-module` pelas portas `catalog` e `recipes`; `useCases.getLevels` é o `StockLevelPort`
 * que o `recipe-module` recebe para a lista de compras.
 */

import type { ClockPort, LoggerPort } from '@adatechnology/recipe-contracts'
import {
  StockConfigMissingError,
  type IngredientCatalogPort,
  type RecipeSourcePort,
  type StockHooks,
  type StockModuleConfig,
} from '@adatechnology/stock-contracts'

import type { StockDatabase } from './database.types'
import { createDrizzleStockPersistence } from './repositories/createDrizzleStockPersistence'
import { DeductOrderUseCase } from './use-cases/Deduction.use-cases'
import { ScanExpiringBatchesUseCase } from './use-cases/Expiry.use-cases'
import {
  ApplyInventoryUseCase,
  CancelInventoryUseCase,
  GetInventoryUseCase,
  ListInventoriesUseCase,
  OpenInventoryUseCase,
  RecordCountsUseCase,
} from './use-cases/Inventory.use-cases'
import {
  GetStockLevelsUseCase,
  GetStockLevelUseCase,
  ListStockLevelsUseCase,
  SetMinimumUseCase,
} from './use-cases/Level.use-cases'
import {
  AdjustStockUseCase,
  ListBatchesUseCase,
  ListMovementsUseCase,
  ReceiveBatchUseCase,
  RecordLossUseCase,
} from './use-cases/Movement.use-cases'
import type { StockDependencies, StockPersistence } from './use-cases/stockModule.types'

export type StockModuleProviders = {
  /** Obrigatório: nome e unidade dos insumos (ex.: sobre o `recipe-module`). */
  readonly catalog: IngredientCatalogPort
  /** Fichas para a baixa por pedido. Ausente: `deductOrder` recusa por configuração. */
  readonly recipes?: RecipeSourcePort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  readonly persistence?: StockPersistence
}

export type CreateStockModuleParams = {
  readonly db?: StockDatabase
  readonly config?: StockModuleConfig
  readonly providers: StockModuleProviders
  readonly hooks?: StockHooks
}

export type StockModule = {
  readonly useCases: {
    readonly getLevels: GetStockLevelsUseCase
    readonly getLevel: GetStockLevelUseCase
    readonly listLevels: ListStockLevelsUseCase
    readonly setMinimum: SetMinimumUseCase
    readonly receiveBatch: ReceiveBatchUseCase
    readonly adjustStock: AdjustStockUseCase
    readonly recordLoss: RecordLossUseCase
    readonly listMovements: ListMovementsUseCase
    readonly listBatches: ListBatchesUseCase
    readonly deductOrder: DeductOrderUseCase
    readonly openInventory: OpenInventoryUseCase
    readonly getInventory: GetInventoryUseCase
    readonly listInventories: ListInventoriesUseCase
    readonly recordCounts: RecordCountsUseCase
    readonly applyInventory: ApplyInventoryUseCase
    readonly cancelInventory: CancelInventoryUseCase
    readonly scanExpiringBatches: ScanExpiringBatchesUseCase
  }
  readonly config: StockModuleConfig
}

const SYSTEM_CLOCK: ClockPort = { now: () => new Date() }

export function createStockModule(params: CreateStockModuleParams): StockModule {
  const config = params.config ?? {}
  if (config.expiryAlertDays !== undefined && (!Number.isInteger(config.expiryAlertDays) || config.expiryAlertDays < 0))
    throw new StockConfigMissingError('expiryAlertDays')
  if (!params.providers?.catalog) throw new StockConfigMissingError('providers.catalog')
  const providers = params.providers
  const persistence = providers.persistence ?? (params.db ? createDrizzleStockPersistence(params.db) : undefined)
  if (!persistence) throw new StockConfigMissingError('db')

  const dependencies: StockDependencies = {
    persistence,
    config,
    clock: providers.clock ?? SYSTEM_CLOCK,
    catalog: providers.catalog,
    ...(providers.recipes ? { recipes: providers.recipes } : {}),
    ...(params.hooks ? { hooks: params.hooks } : {}),
    ...(providers.logger ? { logger: providers.logger } : {}),
  }

  return {
    useCases: {
      getLevels: new GetStockLevelsUseCase(dependencies),
      getLevel: new GetStockLevelUseCase(dependencies),
      listLevels: new ListStockLevelsUseCase(dependencies),
      setMinimum: new SetMinimumUseCase(dependencies),
      receiveBatch: new ReceiveBatchUseCase(dependencies),
      adjustStock: new AdjustStockUseCase(dependencies),
      recordLoss: new RecordLossUseCase(dependencies),
      listMovements: new ListMovementsUseCase(dependencies),
      listBatches: new ListBatchesUseCase(dependencies),
      deductOrder: new DeductOrderUseCase(dependencies),
      openInventory: new OpenInventoryUseCase(dependencies),
      getInventory: new GetInventoryUseCase(dependencies),
      listInventories: new ListInventoriesUseCase(dependencies),
      recordCounts: new RecordCountsUseCase(dependencies),
      applyInventory: new ApplyInventoryUseCase(dependencies),
      cancelInventory: new CancelInventoryUseCase(dependencies),
      scanExpiringBatches: new ScanExpiringBatchesUseCase(dependencies),
    },
    config,
  }
}
