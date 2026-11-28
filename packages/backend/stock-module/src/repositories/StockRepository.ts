/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { ListBatchesQuery, ListMovementsQuery } from '@adatechnology/stock-contracts'
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, lt, lte, sql, type SQL } from 'drizzle-orm'

import type { StockDatabase } from '../database.types'
import { batches, levels, movements, type BatchRow, type LevelRow, type MovementRow } from '../schema/schema'
import type { Page, StockStorePort, StockTransaction } from '../use-cases/stockModule.types'
import { StockTransactionRepository } from './StockTransactionRepository'

const BELOW_MINIMUM = sql`${levels.minimumQuantity} is not null and ${levels.quantity} < ${levels.minimumQuantity}`

export class StockRepository implements StockStorePort {
  constructor(private readonly db: StockDatabase) {}

  transaction<TResult>(work: (transaction: StockTransaction) => Promise<TResult>): Promise<TResult> {
    return this.db.transaction((transaction) =>
      work(new StockTransactionRepository(transaction as unknown as StockDatabase)),
    )
  }

  findLevels(params: { companyId: string; ingredientIds: readonly string[] }): Promise<readonly LevelRow[]> {
    if (params.ingredientIds.length === 0) return Promise.resolve([])
    return this.db
      .select()
      .from(levels)
      .where(and(eq(levels.companyId, params.companyId), inArray(levels.ingredientId, [...params.ingredientIds])))
  }

  async listLevels(params: {
    companyId: string
    page: number
    pageSize: number
    belowMinimum?: boolean
  }): Promise<Page<LevelRow>> {
    const conditions: SQL[] = [eq(levels.companyId, params.companyId)]
    if (params.belowMinimum === true) conditions.push(BELOW_MINIMUM)
    const where = and(...conditions) as SQL
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(levels)
        .where(where)
        // Crítico primeiro: abaixo do mínimo, depois o mexido mais recente.
        .orderBy(desc(sql`(${BELOW_MINIMUM})`), desc(levels.updatedAt), asc(levels.ingredientId))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(levels).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async listLevelIngredientIds(params: { companyId: string; limit: number }): Promise<readonly string[]> {
    const rows = await this.db
      .select({ ingredientId: levels.ingredientId })
      .from(levels)
      .where(eq(levels.companyId, params.companyId))
      .orderBy(asc(levels.ingredientId))
      .limit(params.limit)
    return rows.map((row) => row.ingredientId)
  }

  async upsertMinimum(params: {
    companyId: string
    ingredientId: string
    unit: string
    minimumQuantity: string | null
    now: Date
  }): Promise<LevelRow> {
    const [row] = await this.db
      .insert(levels)
      .values({
        companyId: params.companyId,
        ingredientId: params.ingredientId,
        unit: params.unit,
        minimumQuantity: params.minimumQuantity,
        createdAt: params.now,
        updatedAt: params.now,
      })
      .onConflictDoUpdate({
        target: [levels.companyId, levels.ingredientId],
        set: { minimumQuantity: params.minimumQuantity, updatedAt: params.now },
      })
      .returning()
    return row as LevelRow
  }

  async listMovements(params: ListMovementsQuery & { companyId: string }): Promise<Page<MovementRow>> {
    const conditions: SQL[] = [eq(movements.companyId, params.companyId)]
    if (params.ingredientId) conditions.push(eq(movements.ingredientId, params.ingredientId))
    if (params.kind?.length) conditions.push(inArray(movements.kind, params.kind))
    if (params.from) conditions.push(gte(movements.createdAt, new Date(params.from)))
    if (params.to) conditions.push(lt(movements.createdAt, new Date(params.to)))
    const where = and(...conditions) as SQL
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(movements)
        .where(where)
        .orderBy(desc(movements.createdAt), desc(movements.id))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(movements).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  async listBatches(params: ListBatchesQuery & { companyId: string; expiresBefore?: Date }): Promise<Page<BatchRow>> {
    const conditions: SQL[] = [eq(batches.companyId, params.companyId)]
    if (params.ingredientId) conditions.push(eq(batches.ingredientId, params.ingredientId))
    if (params.onlyWithRemaining) conditions.push(gt(batches.remainingQuantity, '0'))
    if (params.expiresBefore)
      conditions.push(isNotNull(batches.expiresAt), lte(batches.expiresAt, params.expiresBefore))
    const where = and(...conditions) as SQL
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(batches)
        .where(where)
        .orderBy(sql`${batches.expiresAt} asc nulls last`, asc(batches.receivedAt))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      this.db.select({ total: count() }).from(batches).where(where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  findExpiringBatches(params: { expiresBefore: Date; limit: number }): Promise<readonly BatchRow[]> {
    return this.db
      .select()
      .from(batches)
      .where(
        and(
          gt(batches.remainingQuantity, '0'),
          isNotNull(batches.expiresAt),
          lte(batches.expiresAt, params.expiresBefore),
        ),
      )
      .orderBy(asc(batches.companyId), asc(batches.expiresAt))
      .limit(params.limit)
  }
}
