/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê em memória: transações em fila (uma por vez, como as travas do banco) e desfeitas por
 * cópia do estado quando lançam. Serve aos testes do módulo e aos do host.
 */

import { compare, parseDecimal } from '@adatechnology/recipe-contracts'
import {
  INVENTORY_STATUS,
  type InventoryStatus,
  type ListBatchesQuery,
  type ListMovementsQuery,
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
import type {
  InventoryRecord,
  InventoryStorePort,
  InventorySummaryRow,
  Page,
  StockPersistence,
  StockStorePort,
  StockTransaction,
} from '../use-cases/stockModule.types'

export type InMemoryStockState = {
  levels: Map<string, LevelRow>
  batches: Map<string, BatchRow>
  movements: MovementRow[]
  deductions: Set<string>
  inventories: Map<string, InventoryCountRow>
  inventoryLines: InventoryCountLineRow[]
}

const levelKey = (companyId: string, ingredientId: string) => `${companyId}:${ingredientId}`

function emptyState(): InMemoryStockState {
  return {
    levels: new Map(),
    batches: new Map(),
    movements: [],
    deductions: new Set(),
    inventories: new Map(),
    inventoryLines: [],
  }
}

function cloneState(state: InMemoryStockState): InMemoryStockState {
  return {
    levels: new Map([...state.levels].map(([key, row]) => [key, { ...row }])),
    batches: new Map([...state.batches].map(([key, row]) => [key, { ...row }])),
    movements: [...state.movements],
    deductions: new Set(state.deductions),
    inventories: new Map([...state.inventories].map(([key, row]) => [key, { ...row }])),
    inventoryLines: state.inventoryLines.map((line) => ({ ...line })),
  }
}

function paginate<TRow>(rows: readonly TRow[], page: number, pageSize: number): Page<TRow> {
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}

const isBelowMinimum = (row: LevelRow) =>
  row.minimumQuantity !== null && compare(parseDecimal(row.quantity), parseDecimal(row.minimumQuantity)) < 0

function transactionOn(state: () => InMemoryStockState): StockTransaction {
  return {
    async lockLevels(params) {
      const result = new Map<string, LevelRow>()
      for (const ingredient of [...params.ingredients].sort((left, right) => left.id.localeCompare(right.id))) {
        const key = levelKey(params.companyId, ingredient.id)
        if (!state().levels.has(key))
          state().levels.set(key, {
            companyId: params.companyId,
            ingredientId: ingredient.id,
            unit: ingredient.unit,
            quantity: '0.0000',
            minimumQuantity: null,
            createdAt: params.now,
            updatedAt: params.now,
          })
        result.set(ingredient.id, { ...(state().levels.get(key) as LevelRow) })
      }
      return result
    },
    async setLevelQuantity(params) {
      const row = state().levels.get(levelKey(params.companyId, params.ingredientId))
      if (row)
        state().levels.set(levelKey(params.companyId, params.ingredientId), {
          ...row,
          quantity: params.quantity,
          updatedAt: params.now,
        })
    },
    async lockBatches(params) {
      return [...state().batches.values()].filter(
        (row) =>
          row.companyId === params.companyId &&
          row.ingredientId === params.ingredientId &&
          compare(parseDecimal(row.remainingQuantity), parseDecimal('0')) > 0,
      )
    },
    async lockBatch(params) {
      const row = state().batches.get(params.id)
      return row?.companyId === params.companyId ? { ...row } : undefined
    },
    async insertBatch(values: NewBatchRow) {
      const row: BatchRow = {
        id: values.id ?? crypto.randomUUID(),
        companyId: values.companyId,
        ingredientId: values.ingredientId,
        batchCode: values.batchCode,
        unit: values.unit,
        quantity: values.quantity,
        remainingQuantity: values.remainingQuantity,
        costPerUnit: values.costPerUnit ?? null,
        expiresAt: values.expiresAt ?? null,
        receivedAt: values.receivedAt ?? new Date(),
      }
      state().batches.set(row.id, row)
      return row
    },
    async setBatchRemaining(params) {
      const row = state().batches.get(params.id)
      if (row) state().batches.set(row.id, { ...row, remainingQuantity: params.remainingQuantity })
    },
    async insertMovements(values: readonly NewMovementRow[]) {
      const rows = values.map((value) => ({
        id: crypto.randomUUID(),
        batchId: null,
        actorId: null,
        sourceKey: null,
        createdAt: new Date(),
        ...value,
      })) as MovementRow[]
      state().movements.push(...rows)
      return rows
    },
    async claimSourceKey(params) {
      const key = `${params.companyId}:${params.sourceKey}`
      if (state().deductions.has(key)) return false
      state().deductions.add(key)
      return true
    },
    async lockInventory(params) {
      const count = state().inventories.get(params.id)
      if (count?.companyId !== params.companyId) return undefined
      return { count: { ...count }, lines: state().inventoryLines.filter((line) => line.countId === count.id) }
    },
    async closeInventory(params: { companyId: string; id: string; status: InventoryStatus; now: Date }) {
      const count = state().inventories.get(params.id)
      if (count?.companyId === params.companyId)
        state().inventories.set(count.id, { ...count, status: params.status, appliedAt: params.now })
    },
  }
}

export function createInMemoryStockPersistence(
  initial?: InMemoryStockState,
): StockPersistence & { readonly state: () => InMemoryStockState } {
  let state = initial ?? emptyState()
  let queue: Promise<unknown> = Promise.resolve()
  const current = () => state

  const stock: StockStorePort = {
    transaction<TResult>(work: (transaction: StockTransaction) => Promise<TResult>): Promise<TResult> {
      const run = queue.then(async () => {
        const snapshot = cloneState(state)
        try {
          return await work(transactionOn(current))
        } catch (error) {
          state = snapshot
          throw error
        }
      })
      queue = run.catch(() => undefined)
      return run
    },
    async findLevels(params) {
      return params.ingredientIds.flatMap((id) => {
        const row = state.levels.get(levelKey(params.companyId, id))
        return row ? [row] : []
      })
    },
    async listLevels(params) {
      const rows = [...state.levels.values()]
        .filter((row) => row.companyId === params.companyId && (params.belowMinimum !== true || isBelowMinimum(row)))
        .sort(
          (left, right) =>
            Number(isBelowMinimum(right)) - Number(isBelowMinimum(left)) ||
            right.updatedAt.getTime() - left.updatedAt.getTime(),
        )
      return paginate(rows, params.page, params.pageSize)
    },
    async listLevelIngredientIds(params) {
      return [...state.levels.values()]
        .filter((row) => row.companyId === params.companyId)
        .map((row) => row.ingredientId)
        .sort()
        .slice(0, params.limit)
    },
    async upsertMinimum(params) {
      const key = levelKey(params.companyId, params.ingredientId)
      const row: LevelRow = state.levels.get(key)
        ? { ...(state.levels.get(key) as LevelRow), minimumQuantity: params.minimumQuantity, updatedAt: params.now }
        : {
            companyId: params.companyId,
            ingredientId: params.ingredientId,
            unit: params.unit,
            quantity: '0.0000',
            minimumQuantity: params.minimumQuantity,
            createdAt: params.now,
            updatedAt: params.now,
          }
      state.levels.set(key, row)
      return row
    },
    async listMovements(params: ListMovementsQuery & { companyId: string }) {
      const rows = state.movements
        .filter(
          (row) =>
            row.companyId === params.companyId &&
            (!params.ingredientId || row.ingredientId === params.ingredientId) &&
            (!params.kind?.length || params.kind.includes(row.kind as never)),
        )
        .reverse()
      return paginate(rows, params.page, params.pageSize)
    },
    async listBatches(params: ListBatchesQuery & { companyId: string; expiresBefore?: Date }) {
      const rows = [...state.batches.values()].filter(
        (row) =>
          row.companyId === params.companyId &&
          (!params.ingredientId || row.ingredientId === params.ingredientId) &&
          (!params.onlyWithRemaining || compare(parseDecimal(row.remainingQuantity), parseDecimal('0')) > 0) &&
          (!params.expiresBefore || (row.expiresAt !== null && row.expiresAt <= params.expiresBefore)),
      )
      return paginate(rows, params.page, params.pageSize)
    },
    async findExpiringBatches(params) {
      return [...state.batches.values()]
        .filter(
          (row) =>
            row.expiresAt !== null &&
            row.expiresAt <= params.expiresBefore &&
            compare(parseDecimal(row.remainingQuantity), parseDecimal('0')) > 0,
        )
        .slice(0, params.limit)
    },
  }

  const inventories: InventoryStorePort = {
    async insert(params) {
      const open = [...state.inventories.values()].some(
        (row) => row.companyId === params.companyId && row.status === INVENTORY_STATUS.OPEN,
      )
      if (open) throw Object.assign(new Error('unique'), { code: '23505' })
      const count: InventoryCountRow = {
        id: crypto.randomUUID(),
        companyId: params.companyId,
        status: INVENTORY_STATUS.OPEN,
        note: params.note,
        actorId: params.actorId,
        createdAt: params.now,
        appliedAt: null,
      }
      const lines = params.lines.map((line) => ({ ...line, countId: count.id, companyId: params.companyId }))
      state.inventories.set(count.id, count)
      state.inventoryLines.push(...lines)
      return { count, lines }
    },
    async find(params): Promise<InventoryRecord | undefined> {
      const count = state.inventories.get(params.id)
      if (count?.companyId !== params.companyId) return undefined
      return { count, lines: state.inventoryLines.filter((line) => line.countId === count.id) }
    },
    async findOpen(params) {
      return [...state.inventories.values()].find(
        (row) => row.companyId === params.companyId && row.status === INVENTORY_STATUS.OPEN,
      )
    },
    async list(params): Promise<Page<InventorySummaryRow>> {
      const rows = [...state.inventories.values()]
        .filter((row) => row.companyId === params.companyId)
        .map((row) => {
          const lines = state.inventoryLines.filter((line) => line.countId === row.id)
          return {
            ...row,
            lineCount: lines.length,
            countedCount: lines.filter((line) => line.countedQuantity !== null).length,
          }
        })
      return paginate(rows, params.page, params.pageSize)
    },
    async setCounts(params) {
      let updated = 0
      state.inventoryLines = state.inventoryLines.map((line) => {
        const entry = params.counts.find((count) => count.ingredientId === line.ingredientId)
        if (line.countId !== params.id || line.companyId !== params.companyId || !entry) return line
        updated += 1
        return { ...line, countedQuantity: entry.countedQuantity }
      })
      return updated
    },
  }

  return { state: current, stock, inventories }
}
