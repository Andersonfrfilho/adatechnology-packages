/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RecipeHooks, StockLevelPort } from '@adatechnology/recipe-contracts'

import { createRecipeModule, type RecipeModule } from '../RecipeModule'
import { createInMemoryRecipePersistence, type InMemoryState } from './inMemoryPersistence'

export function buildTestModule(params: { readonly hooks?: RecipeHooks; readonly stockLevels?: StockLevelPort } = {}): {
  module: RecipeModule
  state: InMemoryState
} {
  const persistence = createInMemoryRecipePersistence()
  const module = createRecipeModule({
    providers: {
      persistence,
      clock: { now: () => new Date('2026-03-10T12:00:00.000Z') },
      ...(params.stockLevels ? { stockLevels: params.stockLevels } : {}),
    },
    ...(params.hooks ? { hooks: params.hooks } : {}),
  })
  return { module, state: persistence.state }
}
