/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { Recipe } from '@adatechnology/recipe-contracts'
import type { StockHooks, StockIngredient, StockModuleConfig } from '@adatechnology/stock-contracts'

import { createStockModule, type StockModule } from '../StockModule'
import { createInMemoryStockPersistence } from './inMemoryPersistence'

export type TestCatalog = {
  readonly ingredients: Map<string, StockIngredient & { readonly companyId: string }>
  readonly recipes: Recipe[]
}

/** Catálogo e fichas falsos no formato do `recipe-module` (o estoque não depende do módulo de fichas). */
export function buildTestModule(
  params: { readonly hooks?: StockHooks; readonly config?: StockModuleConfig; readonly now?: () => Date } = {},
): {
  module: StockModule
  catalog: TestCatalog
  persistence: ReturnType<typeof createInMemoryStockPersistence>
} {
  const catalog: TestCatalog = { ingredients: new Map(), recipes: [] }
  const persistence = createInMemoryStockPersistence()
  const owned = (companyId: string, ids: readonly string[]) =>
    ids.flatMap((id) => {
      const ingredient = catalog.ingredients.get(id)
      return ingredient?.companyId === companyId
        ? [{ id: ingredient.id, name: ingredient.name, unit: ingredient.unit }]
        : []
    })
  const module = createStockModule({
    providers: {
      persistence,
      clock: { now: params.now ?? (() => new Date('2026-03-10T12:00:00.000Z')) },
      catalog: { findIngredients: async ({ companyId, ingredientIds }) => owned(companyId, ingredientIds) },
      recipes: {
        lookup: async ({ companyId, productIds }) => {
          const recipes = catalog.recipes.filter(
            (recipe) => recipe.companyId === companyId && productIds.includes(recipe.productId),
          )
          return {
            recipes,
            ingredients: owned(
              companyId,
              recipes.flatMap((recipe) => recipe.lines.map((line) => line.ingredientId)),
            ),
          }
        },
      },
    },
    ...(params.config ? { config: params.config } : {}),
    ...(params.hooks ? { hooks: params.hooks } : {}),
  })
  return { module, catalog, persistence }
}
