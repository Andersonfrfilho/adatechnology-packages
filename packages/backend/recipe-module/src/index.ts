/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

export { createRecipeModule } from './RecipeModule'
export type { RecipeModule, RecipeModuleProviders, CreateRecipeModuleParams } from './RecipeModule'

export { createRecipeRoutes } from './http/routes'
export type { CreateRecipeRoutesParams } from './http/routes'

export { runRecipeMigrations, recipeMigrationsFolder, RECIPE_MIGRATIONS_TABLE } from './runMigrations'
export type { RunRecipeMigrationsParams } from './runMigrations'
export type { RecipeDatabase, DrizzleMigrateFunction } from './database.types'

export { recipesSchema, ingredients, recipes, recipeLines } from './schema/schema'
export type {
  IngredientRow,
  NewIngredientRow,
  RecipeRow,
  NewRecipeRow,
  RecipeLineRow,
  NewRecipeLineRow,
} from './schema/schema'

export { createDrizzleRecipePersistence } from './repositories/createDrizzleRecipePersistence'
export { IngredientRepository } from './repositories/IngredientRepository'
export { RecipeRepository } from './repositories/RecipeRepository'
export { REMOVE_RESULT } from './use-cases/recipeModule.types'
export type {
  IngredientStorePort,
  RecipeStorePort,
  RecipePersistence,
  RecipeDependencies,
  RecipeRecord,
  IngredientUsage,
  SaveRecipeValues,
  SaveRecipeLineValues,
  RemoveResult,
  Page,
} from './use-cases/recipeModule.types'

export {
  CreateIngredientUseCase,
  UpdateIngredientUseCase,
  GetIngredientUseCase,
  ListIngredientsUseCase,
  RemoveIngredientUseCase,
  ExportIngredientsUseCase,
  INGREDIENT_EXPORT_HEADER,
} from './use-cases/Ingredient.use-cases'
export {
  GetRecipeUseCase,
  SaveRecipeUseCase,
  RemoveRecipeUseCase,
  CalculateRecipeCostsUseCase,
  LookupRecipesUseCase,
} from './use-cases/Recipe.use-cases'
export type {
  GetRecipeParams,
  SaveRecipeParams,
  CalculateRecipeCostsResult,
  LookupRecipesResult,
} from './use-cases/Recipe.use-cases'
export { BuildShoppingListUseCase, ExportShoppingListUseCase } from './use-cases/ShoppingList.use-cases'
export type { BuildShoppingListParams } from './use-cases/ShoppingList.use-cases'
export type { ExportResult } from './shared/exportFile'

export { createInMemoryRecipePersistence } from './testing/inMemoryPersistence'
export type { InMemoryState } from './testing/inMemoryPersistence'
