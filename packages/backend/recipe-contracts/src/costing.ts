/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Custo da ficha, por porção e margem — puro, o mesmo cálculo na tela (ao vivo) e no servidor.
 */

import {
  add,
  divide,
  formatDecimal,
  fromCents,
  multiply,
  parseDecimal,
  rational,
  subtract,
  toCents,
  ZERO,
  type Rational,
} from './decimal'
import type { Ingredient, RecipeCost, RecipeLine, RecipeLineCost } from './recipe.types'
import { convertQuantity } from './units'

export type RecipeCostSource = {
  readonly productId: string
  readonly yieldPortions: string
  readonly lines: readonly Pick<RecipeLine, 'id' | 'ingredientId' | 'quantity' | 'unit'>[]
}

export type IngredientCostSource = Pick<Ingredient, 'id' | 'unit' | 'costPerUnit'>

export type CalculateRecipeCostParams = {
  readonly recipe: RecipeCostSource
  readonly ingredients: readonly IngredientCostSource[]
  readonly salePriceCents?: number | null
}

export type MarginResult = { readonly marginCents: number | null; readonly marginBasisPoints: number | null }

/** Margem sobre o preço de venda. Preço zero ou ausente: sem margem (não há divisão possível). */
export function calculateMargin(params: {
  readonly costPerPortion: Rational
  readonly salePriceCents?: number | null
}): MarginResult {
  const price = params.salePriceCents
  if (price === undefined || price === null || price <= 0) return { marginCents: null, marginBasisPoints: null }
  const margin = subtract(fromCents(price), params.costPerPortion)
  return {
    marginCents: toCents(margin),
    marginBasisPoints: Number(formatDecimal(multiply(divide(margin, fromCents(price)), rational(10_000n)), 0)),
  }
}

function lineCost(
  line: RecipeCostSource['lines'][number],
  ingredient: IngredientCostSource,
): { quantity: Rational; cost: Rational } {
  const quantity = convertQuantity({ quantity: parseDecimal(line.quantity), from: line.unit, to: ingredient.unit })
  // Unidade incompatível não chega aqui pelo módulo (é recusada ao gravar); na tela, conta zero.
  if (!quantity) return { quantity: ZERO, cost: ZERO }
  return { quantity, cost: multiply(quantity, parseDecimal(ingredient.costPerUnit)) }
}

export function calculateRecipeCost(params: CalculateRecipeCostParams): RecipeCost {
  const ingredientsById = new Map(params.ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const lines: RecipeLineCost[] = []
  const missingIngredientIds: string[] = []
  let total = ZERO

  for (const line of params.recipe.lines) {
    const ingredient = ingredientsById.get(line.ingredientId)
    if (!ingredient) {
      missingIngredientIds.push(line.ingredientId)
      continue
    }
    const { quantity, cost } = lineCost(line, ingredient)
    total = add(total, cost)
    lines.push({
      lineId: line.id,
      ingredientId: line.ingredientId,
      quantityInIngredientUnit: formatDecimal(quantity),
      cost: formatDecimal(cost),
      costCents: toCents(cost),
    })
  }

  const portions = parseDecimal(params.recipe.yieldPortions)
  const perPortion = portions.numerator > 0n ? divide(total, portions) : ZERO
  return {
    productId: params.recipe.productId,
    totalCost: formatDecimal(total),
    totalCostCents: toCents(total),
    costPerPortion: formatDecimal(perPortion),
    costPerPortionCents: toCents(perPortion),
    lines,
    missingIngredientIds,
    salePriceCents: params.salePriceCents ?? null,
    ...calculateMargin({ costPerPortion: perPortion, salePriceCents: params.salePriceCents ?? null }),
  }
}
