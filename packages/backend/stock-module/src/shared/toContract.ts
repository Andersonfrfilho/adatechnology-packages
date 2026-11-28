/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  compare,
  convertQuantity,
  formatDecimal,
  normalizeDecimal,
  parseDecimal,
  type RecipeUnit,
} from '@adatechnology/recipe-contracts'
import type {
  MovementKind,
  StockBatch,
  StockIngredient,
  StockLevelView,
  StockMovement,
} from '@adatechnology/stock-contracts'

import type { BatchRow, LevelRow, MovementRow } from '../schema/schema'

/** Quantidade gravada → unidade atual do insumo (se mudou de g para kg); incompatível fica como está. */
export function inIngredientUnit(params: {
  readonly value: string
  readonly from: string
  readonly ingredient?: StockIngredient
}): {
  value: string
  unit: RecipeUnit
} {
  const from = params.from as RecipeUnit
  const target = params.ingredient?.unit ?? from
  const converted = convertQuantity({ quantity: parseDecimal(params.value), from, to: target })
  return converted
    ? { value: formatDecimal(converted), unit: target }
    : { value: normalizeDecimal(params.value), unit: from }
}

export function toLevelView(row: LevelRow, ingredient: StockIngredient | undefined): StockLevelView {
  const quantity = inIngredientUnit({ value: row.quantity, from: row.unit, ...(ingredient ? { ingredient } : {}) })
  const minimum =
    row.minimumQuantity === null
      ? null
      : inIngredientUnit({ value: row.minimumQuantity, from: row.unit, ...(ingredient ? { ingredient } : {}) }).value
  return {
    ingredientId: row.ingredientId,
    ingredientName: ingredient?.name ?? null,
    unit: quantity.unit,
    quantity: quantity.value,
    minimumQuantity: minimum,
    isBelowMinimum: minimum !== null && compare(parseDecimal(quantity.value), parseDecimal(minimum)) < 0,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toBatch(row: BatchRow): StockBatch {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    batchCode: row.batchCode,
    unit: row.unit as RecipeUnit,
    quantity: normalizeDecimal(row.quantity),
    remainingQuantity: normalizeDecimal(row.remainingQuantity),
    costPerUnit: row.costPerUnit === null ? null : normalizeDecimal(row.costPerUnit),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    receivedAt: row.receivedAt.toISOString(),
  }
}

export function toMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    batchId: row.batchId,
    kind: row.kind as MovementKind,
    delta: normalizeDecimal(row.delta),
    unit: row.unit as RecipeUnit,
    reason: row.reason,
    actorId: row.actorId,
    sourceKey: row.sourceKey,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toPaginated<TRow, TItem>(params: {
  readonly rows: readonly TRow[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly map: (row: TRow) => TItem
}): { data: TItem[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } } {
  return {
    data: params.rows.map(params.map),
    pagination: {
      total: params.total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(params.total / params.pageSize)),
    },
  }
}
