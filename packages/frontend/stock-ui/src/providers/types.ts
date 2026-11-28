/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O host implementa sobre as rotas do `stock-module`. Método ausente = ação ausente na tela.
 */

import type { Paginated } from '@adatechnology/recipe-contracts'
import type {
  AdjustStockInput,
  InventoryCount,
  InventoryCountSummary,
  MovementKind,
  ReceiveBatchInput,
  RecordLossInput,
  StockBatch,
  StockLevelView,
  StockMovement,
} from '@adatechnology/stock-contracts'

export type StockApi = {
  listLevels(params: {
    readonly page: number
    readonly pageSize: number
    readonly belowMinimum?: boolean
  }): Promise<Paginated<StockLevelView>>
  getLevel(ingredientId: string): Promise<StockLevelView>
  setMinimum?(ingredientId: string, minimumQuantity: string | null): Promise<StockLevelView>
  receiveBatch?(input: ReceiveBatchInput): Promise<StockLevelView>
  adjustStock?(input: AdjustStockInput): Promise<StockLevelView>
  recordLoss?(input: RecordLossInput): Promise<StockLevelView>
  listBatches(params: {
    readonly ingredientId?: string
    readonly page: number
    readonly pageSize: number
  }): Promise<Paginated<StockBatch>>
  listMovements(params: {
    readonly ingredientId?: string
    readonly kinds?: readonly MovementKind[]
    readonly page: number
    readonly pageSize: number
  }): Promise<Paginated<StockMovement>>
  /** Ausente: sem a tela de inventário. */
  listInventories?(params: {
    readonly page: number
    readonly pageSize: number
  }): Promise<Paginated<InventoryCountSummary>>
  openInventory?(input: { readonly note: string; readonly ingredientIds?: readonly string[] }): Promise<InventoryCount>
  getInventory?(id: string): Promise<InventoryCount>
  recordCounts?(
    id: string,
    counts: readonly { readonly ingredientId: string; readonly countedQuantity: string | null }[],
  ): Promise<InventoryCount>
  applyInventory?(id: string): Promise<InventoryCount>
  cancelInventory?(id: string): Promise<void>
}
