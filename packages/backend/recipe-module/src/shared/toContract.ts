/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { normalizeDecimal, type Ingredient, type Recipe, type RecipeUnit } from '@adatechnology/recipe-contracts'

import type { IngredientRow } from '../schema/schema'
import type { RecipeRecord } from '../use-cases/recipeModule.types'

export function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    unit: row.unit as RecipeUnit,
    costPerUnit: normalizeDecimal(row.costPerUnit),
    supplier: row.supplier,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toRecipe(record: RecipeRecord): Recipe {
  const { recipe } = record
  return {
    id: recipe.id,
    companyId: recipe.companyId,
    productId: recipe.productId,
    yieldPortions: normalizeDecimal(recipe.yieldPortions),
    preparationTimeMinutes: recipe.preparationTimeMinutes,
    instructions: recipe.instructions,
    lines: [...record.lines]
      .sort((left, right) => left.position - right.position)
      .map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        quantity: normalizeDecimal(line.quantity),
        unit: line.unit as RecipeUnit,
        notes: line.notes,
        position: line.position,
      })),
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
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
