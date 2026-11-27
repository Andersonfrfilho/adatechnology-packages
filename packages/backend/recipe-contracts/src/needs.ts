/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quanto de cada insumo um conjunto de produtos consome, sempre na unidade do insumo. Serve a lista
 * de compras deste módulo e a baixa por pedido do `stock-module`: uma regra só para os dois.
 */

import {
  add,
  divide,
  formatDecimal,
  multiply,
  parseDecimal,
  ROUNDING,
  ZERO,
  type Rational,
  type Rounding,
} from './decimal'
import type { Ingredient, IngredientNeed, Recipe } from './recipe.types'
import type { RecipeUnit } from './units'
import { convertQuantity } from './units'

export type NeedsRecipeSource = Pick<Recipe, 'productId' | 'yieldPortions' | 'lines'>
export type NeedsIngredientSource = Pick<Ingredient, 'id' | 'unit'>

export type CalculateIngredientNeedsParams = {
  /** Unidades do produto (porções); o mesmo produto repetido soma. */
  readonly items: readonly { readonly productId: string; readonly quantity: string }[]
  readonly recipes: readonly NeedsRecipeSource[]
  readonly ingredients: readonly NeedsIngredientSource[]
}

export type ExactIngredientNeed = {
  readonly ingredientId: string
  readonly unit: RecipeUnit
  readonly quantity: Rational
}

export type ExactIngredientNeeds = {
  readonly needs: readonly ExactIngredientNeed[]
  /** Produto sem ficha (ou ficha vazia): nada a consumir, e o painel avisa. */
  readonly productsWithoutRecipe: readonly string[]
  /** Linha com insumo apagado ou unidade sem conversão: fica fora da soma. */
  readonly skippedIngredientIds: readonly string[]
}

function sumPlannedByProduct(items: CalculateIngredientNeedsParams['items']): Map<string, Rational> {
  const planned = new Map<string, Rational>()
  for (const item of items)
    planned.set(item.productId, add(planned.get(item.productId) ?? ZERO, parseDecimal(item.quantity)))
  return planned
}

export function calculateIngredientNeedsExact(params: CalculateIngredientNeedsParams): ExactIngredientNeeds {
  const recipesByProduct = new Map(params.recipes.map((recipe) => [recipe.productId, recipe]))
  const ingredientsById = new Map(params.ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const totals = new Map<string, ExactIngredientNeed>()
  const productsWithoutRecipe: string[] = []
  const skipped = new Set<string>()

  for (const [productId, plannedQuantity] of sumPlannedByProduct(params.items)) {
    const recipe = recipesByProduct.get(productId)
    if (!recipe || recipe.lines.length === 0) {
      productsWithoutRecipe.push(productId)
      continue
    }
    const portionsFactor = divide(plannedQuantity, parseDecimal(recipe.yieldPortions))
    for (const line of recipe.lines) {
      const ingredient = ingredientsById.get(line.ingredientId)
      const converted = ingredient
        ? convertQuantity({ quantity: parseDecimal(line.quantity), from: line.unit, to: ingredient.unit })
        : undefined
      if (!ingredient || !converted) {
        skipped.add(line.ingredientId)
        continue
      }
      const previous = totals.get(ingredient.id)?.quantity ?? ZERO
      totals.set(ingredient.id, {
        ingredientId: ingredient.id,
        unit: ingredient.unit,
        quantity: add(previous, multiply(converted, portionsFactor)),
      })
    }
  }

  return { needs: [...totals.values()], productsWithoutRecipe, skippedIngredientIds: [...skipped] }
}

/** Texto de 4 casas; padrão arredonda para cima (comprar a menos falta, a mais sobra). */
export function formatIngredientNeeds(
  needs: readonly ExactIngredientNeed[],
  rounding: Rounding = ROUNDING.UP,
): IngredientNeed[] {
  return needs.map((need) => ({
    ingredientId: need.ingredientId,
    unit: need.unit,
    quantity: formatDecimal(need.quantity, 4, rounding),
  }))
}
