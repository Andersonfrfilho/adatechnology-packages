/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { StockDatabase } from '../database.types'
import type { StockPersistence } from '../use-cases/stockModule.types'
import { InventoryRepository } from './InventoryRepository'
import { StockRepository } from './StockRepository'

export function createDrizzleStockPersistence(db: StockDatabase): StockPersistence {
  return { stock: new StockRepository(db), inventories: new InventoryRepository(db) }
}
