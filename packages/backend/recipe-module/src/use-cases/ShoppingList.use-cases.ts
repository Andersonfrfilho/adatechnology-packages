/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  buildShoppingList,
  shoppingListTable,
  type ExportFormat,
  type PlannedItem,
  type ShoppingList,
} from '@adatechnology/recipe-contracts'

import { actor, type ActorParams } from '../shared/actor'
import { buildExportFile, type ExportResult } from '../shared/exportFile'
import { runHook } from '../shared/runHook'
import { toRecipe } from '../shared/toContract'
import { loadRecipeIngredients } from './Recipe.use-cases'
import type { RecipeDependencies } from './recipeModule.types'

export type BuildShoppingListParams = { readonly companyId: string; readonly items: readonly PlannedItem[] }

export class BuildShoppingListUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: BuildShoppingListParams): Promise<ShoppingList> {
    const productIds = [...new Set(params.items.map((item) => item.productId))]
    const records = await this.dependencies.persistence.recipes.findByProducts({
      companyId: params.companyId,
      productIds,
    })
    const ingredients = await loadRecipeIngredients({
      dependencies: this.dependencies,
      companyId: params.companyId,
      records,
    })
    // Sem porta de estoque a lista é só a necessidade bruta; o módulo não depende do estoque.
    const stockLevels = this.dependencies.stockLevels
      ? await this.dependencies.stockLevels.getLevels({
          companyId: params.companyId,
          ingredientIds: ingredients.map((ingredient) => ingredient.id),
        })
      : undefined
    return buildShoppingList({
      items: params.items,
      recipes: records.map(toRecipe),
      ingredients,
      ...(stockLevels ? { stockLevels } : {}),
    })
  }
}

export class ExportShoppingListUseCase {
  constructor(
    private readonly dependencies: RecipeDependencies,
    private readonly buildList: BuildShoppingListUseCase,
  ) {}

  async execute(
    params: BuildShoppingListParams & ActorParams & { readonly format: ExportFormat },
  ): Promise<ExportResult> {
    const list = await this.buildList.execute(params)
    const file = buildExportFile({
      table: shoppingListTable(list),
      format: params.format,
      baseName: 'lista-de-compras',
      now: this.dependencies.clock.now(),
      isTruncated: false,
    })
    await runHook({
      name: 'onExported',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, kind: 'shopping-list' },
      run: () =>
        this.dependencies.hooks?.onExported?.({
          ...actor(params),
          kind: 'shopping-list',
          format: params.format,
          rowCount: file.rowCount,
        }),
    })
    return file
  }
}
