/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Lista de compras: necessidade bruta por insumo, menos o estoque quando o host o informa.
 */

import {
  add,
  formatDecimal,
  maximum,
  multiply,
  parseDecimal,
  ROUNDING,
  roundToScale,
  subtract,
  toCents,
  ZERO,
} from './decimal'
import { calculateIngredientNeedsExact, type CalculateIngredientNeedsParams } from './needs'
import type { Ingredient, ShoppingList, ShoppingListRow, StockLevel } from './recipe.types'
import type { SpreadsheetTable } from './spreadsheet/spreadsheet.types'

export type BuildShoppingListParams = Omit<CalculateIngredientNeedsParams, 'ingredients'> & {
  readonly ingredients: readonly Ingredient[]
  /** `undefined`: sem porta de estoque. Lista vazia: porta ligada, nada em estoque. */
  readonly stockLevels?: readonly StockLevel[]
}

export function buildShoppingList(params: BuildShoppingListParams): ShoppingList {
  const exact = calculateIngredientNeedsExact(params)
  const ingredientsById = new Map(params.ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const stockById = new Map(
    (params.stockLevels ?? []).map((level) => [level.ingredientId, parseDecimal(level.quantity)]),
  )
  const hasStockData = params.stockLevels !== undefined
  let totalCents = 0

  const rows: ShoppingListRow[] = exact.needs.flatMap((need) => {
    const ingredient = ingredientsById.get(need.ingredientId)
    if (!ingredient) return []
    const gross = roundToScale(need.quantity, 4, ROUNDING.UP)
    const stock = hasStockData ? (stockById.get(need.ingredientId) ?? ZERO) : undefined
    const net = stock === undefined ? gross : maximum(ZERO, subtract(gross, maximum(ZERO, stock)))
    const cost = multiply(net, parseDecimal(ingredient.costPerUnit))
    const costCents = toCents(cost)
    totalCents += costCents
    return [
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        grossQuantity: formatDecimal(gross),
        stockQuantity: stock === undefined ? null : formatDecimal(stock),
        netQuantity: formatDecimal(net),
        costPerUnit: ingredient.costPerUnit,
        estimatedCost: formatDecimal(cost),
        estimatedCostCents: costCents,
        supplier: ingredient.supplier,
      },
    ]
  })

  rows.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  return { rows, productsWithoutRecipe: exact.productsWithoutRecipe, hasStockData, totalEstimatedCostCents: totalCents }
}

export type ShoppingListHeaders = {
  readonly name: string
  readonly unit: string
  readonly gross: string
  readonly stock: string
  readonly net: string
  readonly costPerUnit: string
  readonly estimatedCost: string
  readonly supplier: string
}

export const SHOPPING_LIST_HEADERS: ShoppingListHeaders = {
  name: 'Insumo',
  unit: 'Unidade',
  gross: 'Necessário',
  stock: 'Em estoque',
  net: 'Comprar',
  costPerUnit: 'Custo por unidade',
  estimatedCost: 'Custo estimado',
  supplier: 'Fornecedor',
}

/** Números como número na planilha (somáveis); estoque some quando não há porta de estoque. */
export function shoppingListTable(
  list: ShoppingList,
  headers: ShoppingListHeaders = SHOPPING_LIST_HEADERS,
): SpreadsheetTable {
  const withStock = list.hasStockData
  return {
    header: [
      headers.name,
      headers.unit,
      headers.gross,
      ...(withStock ? [headers.stock] : []),
      headers.net,
      headers.costPerUnit,
      headers.estimatedCost,
      headers.supplier,
    ],
    rows: list.rows.map((row) => [
      row.name,
      row.unit,
      Number(row.grossQuantity),
      ...(withStock ? [Number(row.stockQuantity ?? '0')] : []),
      Number(row.netQuantity),
      Number(row.costPerUnit),
      Number(row.estimatedCost),
      row.supplier,
    ]),
  }
}

/** Soma exata de custos já formatados (o total da tela não pode divergir do arquivo). */
export function sumDecimals(values: readonly string[]): string {
  return formatDecimal(values.reduce((total, value) => add(total, parseDecimal(value)), ZERO))
}
