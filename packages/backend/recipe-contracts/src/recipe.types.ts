/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quantidade e dinheiro trafegam como texto decimal de 4 casas (`"12.5000"`): exato no JSON, sem
 * ponto flutuante. Centavos (`*Cents`) são inteiros arredondados meio para cima.
 */

import type { RecipeUnit } from './units'

export type Ingredient = {
  readonly id: string
  readonly companyId: string
  readonly name: string
  /** Unidade em que o insumo é comprado e custeado (`kg`, `l`, `un`…). */
  readonly unit: RecipeUnit
  /** Custo de uma `unit`, na moeda do host (`"32.9000"` = R$ 32,90 o kg). */
  readonly costPerUnit: string
  readonly supplier: string | null
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type RecipeLine = {
  readonly id: string
  readonly ingredientId: string
  /** Na unidade da linha, que pode diferir da do insumo desde que compatível (200 g de um insumo em kg). */
  readonly quantity: string
  readonly unit: RecipeUnit
  readonly notes: string | null
  readonly position: number
}

/** Ficha técnica de um produto do host (`productId` é referência opaca: o módulo não tem produtos). */
export type Recipe = {
  readonly id: string
  readonly companyId: string
  readonly productId: string
  /** Porções que a receita rende; uma unidade vendida do produto consome uma porção. */
  readonly yieldPortions: string
  readonly preparationTimeMinutes: number | null
  readonly instructions: string
  readonly lines: readonly RecipeLine[]
  readonly createdAt: string
  readonly updatedAt: string
}

export type RecipeLineCost = {
  readonly lineId: string
  readonly ingredientId: string
  /** Quantidade convertida para a unidade do insumo. */
  readonly quantityInIngredientUnit: string
  readonly cost: string
  readonly costCents: number
}

export type RecipeCost = {
  readonly productId: string
  readonly totalCost: string
  readonly totalCostCents: number
  readonly costPerPortion: string
  readonly costPerPortionCents: number
  readonly lines: readonly RecipeLineCost[]
  /** Linha cujo insumo não existe mais: entra com custo zero e o painel avisa. */
  readonly missingIngredientIds: readonly string[]
  /** Preço de venda que o host informou; sem ele, a margem fica `null`. */
  readonly salePriceCents: number | null
  readonly marginCents: number | null
  /** Margem sobre o preço em pontos-base (`3250` = 32,50 %). */
  readonly marginBasisPoints: number | null
}

export type RecipeWithCost = { readonly recipe: Recipe; readonly cost: RecipeCost }

/** Ficha com custo e os insumos que as linhas usam (nome e unidade para a tela, sem outra consulta). */
export type RecipeDetail = RecipeWithCost & { readonly ingredients: readonly Ingredient[] }

/** Necessidade de um insumo, sempre na unidade do insumo. */
export type IngredientNeed = {
  readonly ingredientId: string
  readonly unit: RecipeUnit
  readonly quantity: string
}

export type StockLevel = {
  readonly ingredientId: string
  /** Na unidade do insumo. Negativo é aceito (estoque furado) e conta como zero na compra. */
  readonly quantity: string
}

export type ShoppingListRow = {
  readonly ingredientId: string
  readonly name: string
  readonly unit: RecipeUnit
  readonly grossQuantity: string
  /** `null` sem porta de estoque: a lista mostra só a necessidade bruta. */
  readonly stockQuantity: string | null
  readonly netQuantity: string
  readonly costPerUnit: string
  readonly estimatedCost: string
  readonly estimatedCostCents: number
  readonly supplier: string | null
}

export type ShoppingList = {
  readonly rows: readonly ShoppingListRow[]
  readonly productsWithoutRecipe: readonly string[]
  readonly hasStockData: boolean
  readonly totalEstimatedCostCents: number
}

export type Pagination = {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

export type Paginated<TItem> = {
  readonly data: readonly TItem[]
  readonly pagination: Pagination
}
