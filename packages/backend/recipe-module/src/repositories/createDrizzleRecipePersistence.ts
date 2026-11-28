/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RecipeDatabase } from '../database.types'
import type { RecipePersistence } from '../use-cases/recipeModule.types'
import { IngredientRepository } from './IngredientRepository'
import { RecipeRepository } from './RecipeRepository'

export function createDrizzleRecipePersistence(db: RecipeDatabase): RecipePersistence {
  return { ingredients: new IngredientRepository(db), recipes: new RecipeRepository(db) }
}
