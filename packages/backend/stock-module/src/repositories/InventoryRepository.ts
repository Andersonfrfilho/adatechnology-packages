/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { INVENTORY_STATUS } from '@adatechnology/stock-contracts'
import { and, count, desc, eq, sql } from 'drizzle-orm'

import type { StockDatabase } from '../database.types'
import {
  inventoryCountLines,
  inventoryCounts,
  type InventoryCountLineRow,
  type InventoryCountRow,
} from '../schema/schema'
import type { InventoryRecord, InventoryStorePort, InventorySummaryRow, Page } from '../use-cases/stockModule.types'

export class InventoryRepository implements InventoryStorePort {
  constructor(private readonly db: StockDatabase) {}

  insert(params: {
    companyId: string
    note: string
    actorId: string | null
    lines: readonly Omit<InventoryCountLineRow, 'countId' | 'companyId'>[]
    now: Date
  }): Promise<InventoryRecord> {
    return this.db.transaction(async (transaction) => {
      const [count] = await transaction
        .insert(inventoryCounts)
        .values({ companyId: params.companyId, note: params.note, actorId: params.actorId, createdAt: params.now })
        .returning()
      if (!count) throw new Error('stock: inventário não gravado')
      const lines =
        params.lines.length === 0
          ? []
          : await transaction
              .insert(inventoryCountLines)
              .values(params.lines.map((line) => ({ ...line, countId: count.id, companyId: params.companyId })))
              .returning()
      return { count, lines }
    })
  }

  async find(params: { companyId: string; id: string }): Promise<InventoryRecord | undefined> {
    const [count] = await this.db
      .select()
      .from(inventoryCounts)
      .where(and(eq(inventoryCounts.companyId, params.companyId), eq(inventoryCounts.id, params.id)))
    if (!count) return undefined
    const lines = await this.db.select().from(inventoryCountLines).where(eq(inventoryCountLines.countId, count.id))
    return { count, lines }
  }

  async findOpen(params: { companyId: string }): Promise<InventoryCountRow | undefined> {
    const [row] = await this.db
      .select()
      .from(inventoryCounts)
      .where(and(eq(inventoryCounts.companyId, params.companyId), eq(inventoryCounts.status, INVENTORY_STATUS.OPEN)))
    return row
  }

  async list(params: { companyId: string; page: number; pageSize: number }): Promise<Page<InventorySummaryRow>> {
    const where = eq(inventoryCounts.companyId, params.companyId)
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          count: inventoryCounts,
          lineCount: sql<number>`(select count(*)::int from ${inventoryCountLines} where ${inventoryCountLines.countId} = ${inventoryCounts.id})`,
          countedCount: sql<number>`(select count(*)::int from ${inventoryCountLines} where ${inventoryCountLines.countId} = ${inventoryCounts.id} and ${inventoryCountLines.countedQuantity} is not null)`,
        })
        .from(inventoryCounts)
        .where(where)
        .orderBy(desc(inventoryCounts.createdAt))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(inventoryCounts).where(where),
    ])
    return {
      rows: rows.map((row) => ({
        ...row.count,
        lineCount: Number(row.lineCount),
        countedCount: Number(row.countedCount),
      })),
      total: totals[0]?.total ?? 0,
    }
  }

  async setCounts(params: {
    companyId: string
    id: string
    counts: readonly { ingredientId: string; countedQuantity: string | null }[]
  }): Promise<number> {
    let updated = 0
    // Sequencial de propósito: é uma transação por chamada, poucas linhas por envio.
    await this.db.transaction(async (transaction) => {
      for (const entry of params.counts) {
        const rows = await transaction
          .update(inventoryCountLines)
          .set({ countedQuantity: entry.countedQuantity })
          .where(
            and(
              eq(inventoryCountLines.companyId, params.companyId),
              eq(inventoryCountLines.countId, params.id),
              eq(inventoryCountLines.ingredientId, entry.ingredientId),
            ),
          )
          .returning({ ingredientId: inventoryCountLines.ingredientId })
        updated += rows.length
      }
    })
    return updated
  }
}
