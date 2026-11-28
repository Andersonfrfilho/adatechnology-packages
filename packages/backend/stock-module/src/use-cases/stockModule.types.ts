/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas de persistência. Toda escrita que mexe em saldo passa por `transaction`, com o nível (e
 * os lotes) travados: duas baixas simultâneas do mesmo insumo nunca leem o mesmo saldo.
 */

import type { ClockPort, LoggerPort, RecipeUnit } from '@adatechnology/recipe-contracts'
import type {
  IngredientCatalogPort,
  InventoryStatus,
  ListBatchesQuery,
  ListMovementsQuery,
  RecipeSourcePort,
  StockHooks,
  StockModuleConfig,
} from '@adatechnology/stock-contracts'

import type {
  BatchRow,
  InventoryCountLineRow,
  InventoryCountRow,
  LevelRow,
  MovementRow,
  NewBatchRow,
  NewMovementRow,
} from '../schema/schema'

export type Page<TRow> = { readonly rows: readonly TRow[]; readonly total: number }

export type InventoryRecord = { readonly count: InventoryCountRow; readonly lines: readonly InventoryCountLineRow[] }
export type InventorySummaryRow = InventoryCountRow & { readonly lineCount: number; readonly countedCount: number }

export interface StockTransaction {
  /** Cria o nível que falta (na unidade dada) e trava todos, em ordem de id (sem deadlock). */
  lockLevels(params: {
    readonly companyId: string
    readonly ingredients: readonly { readonly id: string; readonly unit: RecipeUnit }[]
    readonly now: Date
  }): Promise<ReadonlyMap<string, LevelRow>>
  setLevelQuantity(params: {
    readonly companyId: string
    readonly ingredientId: string
    readonly quantity: string
    readonly now: Date
  }): Promise<void>
  /** Lotes com saldo do insumo, travados. */
  lockBatches(params: { readonly companyId: string; readonly ingredientId: string }): Promise<readonly BatchRow[]>
  lockBatch(params: { readonly companyId: string; readonly id: string }): Promise<BatchRow | undefined>
  insertBatch(values: NewBatchRow): Promise<BatchRow>
  setBatchRemaining(params: { readonly id: string; readonly remainingQuantity: string }): Promise<void>
  insertMovements(values: readonly NewMovementRow[]): Promise<readonly MovementRow[]>
  /** `false` quando a chave já foi baixada (idempotência por linha de pedido). */
  claimSourceKey(params: {
    readonly companyId: string
    readonly sourceKey: string
    readonly now: Date
  }): Promise<boolean>
  lockInventory(params: { readonly companyId: string; readonly id: string }): Promise<InventoryRecord | undefined>
  closeInventory(params: {
    readonly companyId: string
    readonly id: string
    readonly status: InventoryStatus
    readonly now: Date
  }): Promise<void>
}

export interface StockStorePort {
  transaction<TResult>(work: (transaction: StockTransaction) => Promise<TResult>): Promise<TResult>
  findLevels(params: {
    readonly companyId: string
    readonly ingredientIds: readonly string[]
  }): Promise<readonly LevelRow[]>
  listLevels(params: {
    readonly companyId: string
    readonly page: number
    readonly pageSize: number
    readonly belowMinimum?: boolean
  }): Promise<Page<LevelRow>>
  listLevelIngredientIds(params: { readonly companyId: string; readonly limit: number }): Promise<readonly string[]>
  upsertMinimum(params: {
    readonly companyId: string
    readonly ingredientId: string
    readonly unit: RecipeUnit
    readonly minimumQuantity: string | null
    readonly now: Date
  }): Promise<LevelRow>
  listMovements(params: ListMovementsQuery & { readonly companyId: string }): Promise<Page<MovementRow>>
  listBatches(
    params: ListBatchesQuery & { readonly companyId: string; readonly expiresBefore?: Date },
  ): Promise<Page<BatchRow>>
  /** Todas as empresas: a varredura de validade é um job do host. */
  findExpiringBatches(params: { readonly expiresBefore: Date; readonly limit: number }): Promise<readonly BatchRow[]>
}

export interface InventoryStorePort {
  /** Lança violação de unicidade se já houver inventário aberto na empresa. */
  insert(params: {
    readonly companyId: string
    readonly note: string
    readonly actorId: string | null
    readonly lines: readonly Omit<InventoryCountLineRow, 'countId' | 'companyId'>[]
    readonly now: Date
  }): Promise<InventoryRecord>
  find(params: { readonly companyId: string; readonly id: string }): Promise<InventoryRecord | undefined>
  findOpen(params: { readonly companyId: string }): Promise<InventoryCountRow | undefined>
  list(params: {
    readonly companyId: string
    readonly page: number
    readonly pageSize: number
  }): Promise<Page<InventorySummaryRow>>
  setCounts(params: {
    readonly companyId: string
    readonly id: string
    readonly counts: readonly { readonly ingredientId: string; readonly countedQuantity: string | null }[]
  }): Promise<number>
}

export type StockPersistence = { readonly stock: StockStorePort; readonly inventories: InventoryStorePort }

export type StockDependencies = {
  readonly persistence: StockPersistence
  readonly config: StockModuleConfig
  readonly clock: ClockPort
  readonly catalog: IngredientCatalogPort
  readonly recipes?: RecipeSourcePort
  readonly hooks?: StockHooks
  readonly logger?: LoggerPort
}
