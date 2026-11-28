/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { InventoryStatus } from '@adatechnology/stock-contracts'
import { and, asc, eq, gt, inArray } from 'drizzle-orm'

import type { StockDatabase } from '../database.types'
import {
  batches,
  deductions,
  inventoryCountLines,
  inventoryCounts,
  levels,
  movements,
  type BatchRow,
  type LevelRow,
  type MovementRow,
  type NewBatchRow,
  type NewMovementRow,
} from '../schema/schema'
import type { InventoryRecord, StockTransaction } from '../use-cases/stockModule.types'

export class StockTransactionRepository implements StockTransaction {
  constructor(private readonly db: StockDatabase) {}

  async lockLevels(params: {
    companyId: string
    ingredients: readonly { id: string; unit: string }[]
    now: Date
  }): Promise<ReadonlyMap<string, LevelRow>> {
    if (params.ingredients.length === 0) return new Map()
    await this.db
      .insert(levels)
      .values(
        params.ingredients.map((ingredient) => ({
          companyId: params.companyId,
          ingredientId: ingredient.id,
          unit: ingredient.unit,
          createdAt: params.now,
          updatedAt: params.now,
        })),
      )
      .onConflictDoNothing()
    const rows = await this.db
      .select()
      .from(levels)
      .where(
        and(
          eq(levels.companyId, params.companyId),
          inArray(
            levels.ingredientId,
            params.ingredients.map((ingredient) => ingredient.id),
          ),
        ),
      )
      .orderBy(asc(levels.ingredientId))
      .for('update')
    return new Map(rows.map((row) => [row.ingredientId, row]))
  }

  async setLevelQuantity(params: {
    companyId: string
    ingredientId: string
    quantity: string
    now: Date
  }): Promise<void> {
    await this.db
      .update(levels)
      .set({ quantity: params.quantity, updatedAt: params.now })
      .where(and(eq(levels.companyId, params.companyId), eq(levels.ingredientId, params.ingredientId)))
  }

  lockBatches(params: { companyId: string; ingredientId: string }): Promise<readonly BatchRow[]> {
    return this.db
      .select()
      .from(batches)
      .where(
        and(
          eq(batches.companyId, params.companyId),
          eq(batches.ingredientId, params.ingredientId),
          gt(batches.remainingQuantity, '0'),
        ),
      )
      .orderBy(asc(batches.id))
      .for('update')
  }

  async lockBatch(params: { companyId: string; id: string }): Promise<BatchRow | undefined> {
    const [row] = await this.db
      .select()
      .from(batches)
      .where(and(eq(batches.companyId, params.companyId), eq(batches.id, params.id)))
      .for('update')
    return row
  }

  async insertBatch(values: NewBatchRow): Promise<BatchRow> {
    const [row] = await this.db.insert(batches).values(values).returning()
    return row as BatchRow
  }

  async setBatchRemaining(params: { id: string; remainingQuantity: string }): Promise<void> {
    await this.db.update(batches).set({ remainingQuantity: params.remainingQuantity }).where(eq(batches.id, params.id))
  }

  async insertMovements(values: readonly NewMovementRow[]): Promise<readonly MovementRow[]> {
    if (values.length === 0) return []
    return this.db
      .insert(movements)
      .values([...values])
      .returning()
  }

  async claimSourceKey(params: { companyId: string; sourceKey: string; now: Date }): Promise<boolean> {
    const claimed = await this.db
      .insert(deductions)
      .values({ companyId: params.companyId, sourceKey: params.sourceKey, createdAt: params.now })
      .onConflictDoNothing()
      .returning({ sourceKey: deductions.sourceKey })
    return claimed.length > 0
  }

  async lockInventory(params: { companyId: string; id: string }): Promise<InventoryRecord | undefined> {
    const [count] = await this.db
      .select()
      .from(inventoryCounts)
      .where(and(eq(inventoryCounts.companyId, params.companyId), eq(inventoryCounts.id, params.id)))
      .for('update')
    if (!count) return undefined
    const lines = await this.db.select().from(inventoryCountLines).where(eq(inventoryCountLines.countId, count.id))
    return { count, lines }
  }

  async closeInventory(params: { companyId: string; id: string; status: InventoryStatus; now: Date }): Promise<void> {
    await this.db
      .update(inventoryCounts)
      .set({ status: params.status, appliedAt: params.now })
      .where(and(eq(inventoryCounts.companyId, params.companyId), eq(inventoryCounts.id, params.id)))
  }
}
