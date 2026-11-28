/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Composição raiz do módulo de fichas técnicas. Recebe a conexão Drizzle do host e devolve os
 * use cases; as rotas saem de `createRecipeRoutes` sobre este objeto.
 */

import {
  RecipeConfigMissingError,
  type ClockPort,
  type LoggerPort,
  type ProductReferencePort,
  type RecipeHooks,
  type RecipeModuleConfig,
  type StockLevelPort,
} from '@adatechnology/recipe-contracts'

import type { RecipeDatabase } from './database.types'
import { createDrizzleRecipePersistence } from './repositories/createDrizzleRecipePersistence'
import {
  CreateIngredientUseCase,
  ExportIngredientsUseCase,
  FindIngredientsUseCase,
  GetIngredientUseCase,
  ListIngredientsUseCase,
  RemoveIngredientUseCase,
  UpdateIngredientUseCase,
} from './use-cases/Ingredient.use-cases'
import {
  CalculateRecipeCostsUseCase,
  GetRecipeUseCase,
  LookupRecipesUseCase,
  RemoveRecipeUseCase,
  SaveRecipeUseCase,
} from './use-cases/Recipe.use-cases'
import type { RecipeDependencies, RecipePersistence } from './use-cases/recipeModule.types'
import { BuildShoppingListUseCase, ExportShoppingListUseCase } from './use-cases/ShoppingList.use-cases'

export type RecipeModuleProviders = {
  /** Estoque atual (ex.: `stock-module`). Ausente: lista de compras com a necessidade bruta. */
  readonly stockLevels?: StockLevelPort
  /** Confere o produto no catálogo do host antes de gravar a ficha. Ausente: aceita qualquer id. */
  readonly productReference?: ProductReferencePort
  readonly clock?: ClockPort
  readonly logger?: LoggerPort
  /** Troca a persistência (ex.: dublê em memória num teste do host). Padrão: Drizzle sobre `db`. */
  readonly persistence?: RecipePersistence
}

export type CreateRecipeModuleParams = {
  readonly db?: RecipeDatabase
  readonly config?: RecipeModuleConfig
  readonly providers?: RecipeModuleProviders
  readonly hooks?: RecipeHooks
}

export type RecipeModule = {
  readonly useCases: {
    readonly createIngredient: CreateIngredientUseCase
    readonly updateIngredient: UpdateIngredientUseCase
    readonly getIngredient: GetIngredientUseCase
    readonly findIngredients: FindIngredientsUseCase
    readonly listIngredients: ListIngredientsUseCase
    readonly removeIngredient: RemoveIngredientUseCase
    readonly exportIngredients: ExportIngredientsUseCase
    readonly getRecipe: GetRecipeUseCase
    readonly saveRecipe: SaveRecipeUseCase
    readonly removeRecipe: RemoveRecipeUseCase
    readonly calculateRecipeCosts: CalculateRecipeCostsUseCase
    readonly lookupRecipes: LookupRecipesUseCase
    readonly buildShoppingList: BuildShoppingListUseCase
    readonly exportShoppingList: ExportShoppingListUseCase
  }
  readonly config: RecipeModuleConfig
}

const SYSTEM_CLOCK: ClockPort = { now: () => new Date() }

export function createRecipeModule(params: CreateRecipeModuleParams): RecipeModule {
  const config = params.config ?? {}
  if (config.exportRowLimit !== undefined && (!Number.isInteger(config.exportRowLimit) || config.exportRowLimit < 1))
    throw new RecipeConfigMissingError('exportRowLimit')
  const providers = params.providers ?? {}
  const persistence = providers.persistence ?? (params.db ? createDrizzleRecipePersistence(params.db) : undefined)
  if (!persistence) throw new RecipeConfigMissingError('db')

  const dependencies: RecipeDependencies = {
    persistence,
    config,
    clock: providers.clock ?? SYSTEM_CLOCK,
    ...(params.hooks ? { hooks: params.hooks } : {}),
    ...(providers.logger ? { logger: providers.logger } : {}),
    ...(providers.stockLevels ? { stockLevels: providers.stockLevels } : {}),
    ...(providers.productReference ? { productReference: providers.productReference } : {}),
  }

  if (!params.hooks?.onExported)
    dependencies.logger?.warn('recipes: hooks.onExported ausente — exportações sem trilha de auditoria do host')

  const buildShoppingList = new BuildShoppingListUseCase(dependencies)
  return {
    useCases: {
      createIngredient: new CreateIngredientUseCase(dependencies),
      updateIngredient: new UpdateIngredientUseCase(dependencies),
      getIngredient: new GetIngredientUseCase(dependencies),
      findIngredients: new FindIngredientsUseCase(dependencies),
      listIngredients: new ListIngredientsUseCase(dependencies),
      removeIngredient: new RemoveIngredientUseCase(dependencies),
      exportIngredients: new ExportIngredientsUseCase(dependencies),
      getRecipe: new GetRecipeUseCase(dependencies),
      saveRecipe: new SaveRecipeUseCase(dependencies),
      removeRecipe: new RemoveRecipeUseCase(dependencies),
      calculateRecipeCosts: new CalculateRecipeCostsUseCase(dependencies),
      lookupRecipes: new LookupRecipesUseCase(dependencies),
      buildShoppingList,
      exportShoppingList: new ExportShoppingListUseCase(dependencies, buildShoppingList),
    },
    config,
  }
}
