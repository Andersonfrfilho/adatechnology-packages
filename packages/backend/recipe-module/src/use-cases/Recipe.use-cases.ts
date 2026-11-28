/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  areUnitsCompatible,
  calculateRecipeCost,
  IncompatibleUnitError,
  RecipeNotFoundError,
  UnknownIngredientsError,
  UnknownProductsError,
  type Ingredient,
  type LineUnitIssue,
  type Recipe,
  type RecipeCost,
  type RecipeDetail,
  type SaveRecipeData,
} from '@adatechnology/recipe-contracts'

import { actor, type ActorParams } from '../shared/actor'
import { isForeignKeyViolation } from '../shared/postgresErrors'
import { runHook } from '../shared/runHook'
import { toIngredient, toRecipe } from '../shared/toContract'
import type { RecipeDependencies, RecipeRecord, SaveRecipeLineValues } from './recipeModule.types'

/** Insumos de todas as linhas das fichas, numa consulta (sem N+1). */
export async function loadRecipeIngredients(params: {
  readonly dependencies: RecipeDependencies
  readonly companyId: string
  readonly records: readonly RecipeRecord[]
}): Promise<Ingredient[]> {
  const ids = [...new Set(params.records.flatMap((record) => record.lines.map((line) => line.ingredientId)))]
  const rows = await params.dependencies.persistence.ingredients.findByIds({ companyId: params.companyId, ids })
  return rows.map(toIngredient)
}

function withCost(params: {
  recipe: Recipe
  ingredients: readonly Ingredient[]
  salePriceCents?: number | null
}): RecipeDetail {
  return {
    recipe: params.recipe,
    ingredients: params.ingredients,
    cost: calculateRecipeCost({
      recipe: params.recipe,
      ingredients: params.ingredients,
      salePriceCents: params.salePriceCents ?? null,
    }),
  }
}

export type GetRecipeParams = {
  readonly companyId: string
  readonly productId: string
  readonly salePriceCents?: number
}

export class GetRecipeUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: GetRecipeParams): Promise<RecipeDetail> {
    const record = await this.dependencies.persistence.recipes.findByProduct(params)
    if (!record) throw new RecipeNotFoundError(params.productId)
    const ingredients = await loadRecipeIngredients({
      dependencies: this.dependencies,
      companyId: params.companyId,
      records: [record],
    })
    return withCost({ recipe: toRecipe(record), ingredients, salePriceCents: params.salePriceCents ?? null })
  }
}

export type SaveRecipeParams = ActorParams & {
  readonly productId: string
  readonly input: SaveRecipeData
  readonly salePriceCents?: number
}

function unitIssues(input: SaveRecipeData, ingredientsById: ReadonlyMap<string, Ingredient>): LineUnitIssue[] {
  return input.lines.flatMap((line, index) => {
    const ingredient = ingredientsById.get(line.ingredientId)
    if (!ingredient || areUnitsCompatible(line.unit, ingredient.unit)) return []
    return [{ index, ingredientId: line.ingredientId, unit: line.unit, ingredientUnit: ingredient.unit }]
  })
}

export class SaveRecipeUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  private async assertProductExists(params: { companyId: string; productId: string }): Promise<void> {
    const port = this.dependencies.productReference
    if (!port) return
    const existing = await port.findExisting({ companyId: params.companyId, productIds: [params.productId] })
    if (!existing.includes(params.productId)) throw new UnknownProductsError([params.productId])
  }

  private async validateLines(params: SaveRecipeParams): Promise<Ingredient[]> {
    const ids = [...new Set(params.input.lines.map((line) => line.ingredientId))]
    const rows = await this.dependencies.persistence.ingredients.findByIds({ companyId: params.companyId, ids })
    const ingredients = rows.map(toIngredient)
    const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
    const unknown = ids.filter((id) => !byId.has(id))
    if (unknown.length > 0) throw new UnknownIngredientsError(unknown)
    const issues = unitIssues(params.input, byId)
    if (issues.length > 0) throw new IncompatibleUnitError(issues)
    return ingredients
  }

  /** Linha que já era desta ficha mantém o id; id de outra ficha (ou inventado) vira linha nova. */
  private lineValues(input: SaveRecipeData, current: RecipeRecord | undefined): SaveRecipeLineValues[] {
    const currentIds = new Set(current?.lines.map((line) => line.id) ?? [])
    return input.lines.map((line, position) => ({
      id: line.id && currentIds.has(line.id) ? line.id : crypto.randomUUID(),
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unit: line.unit,
      notes: line.notes,
      position,
    }))
  }

  async execute(params: SaveRecipeParams): Promise<RecipeDetail> {
    await this.assertProductExists(params)
    const ingredients = await this.validateLines(params)
    const { recipes } = this.dependencies.persistence
    const current = await recipes.findByProduct(params)
    const saved = await recipes
      .save({
        companyId: params.companyId,
        productId: params.productId,
        values: {
          yieldPortions: params.input.yieldPortions,
          preparationTimeMinutes: params.input.preparationTimeMinutes,
          instructions: params.input.instructions,
        },
        lines: this.lineValues(params.input, current),
        now: this.dependencies.clock.now(),
      })
      .catch((error: unknown) => {
        // Insumo apagado entre a validação e a gravação: a FK composta recusa.
        if (isForeignKeyViolation(error))
          throw new UnknownIngredientsError(params.input.lines.map((line) => line.ingredientId))
        throw error
      })
    const recipe = toRecipe(saved.record)
    await runHook({
      name: 'onRecipeSaved',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, recipeId: recipe.id },
      run: () => this.dependencies.hooks?.onRecipeSaved?.({ ...actor(params), recipe, isNew: saved.isNew }),
    })
    return withCost({ recipe, ingredients, salePriceCents: params.salePriceCents ?? null })
  }
}

export class RemoveRecipeUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: ActorParams & { readonly productId: string }): Promise<void> {
    const removed = await this.dependencies.persistence.recipes.remove(params)
    if (!removed) throw new RecipeNotFoundError(params.productId)
    await runHook({
      name: 'onRecipeRemoved',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId },
      run: () => this.dependencies.hooks?.onRecipeRemoved?.({ ...actor(params), productId: params.productId }),
    })
  }
}

export type CalculateRecipeCostsResult = {
  readonly costs: readonly RecipeCost[]
  readonly productsWithoutRecipe: readonly string[]
}

/** Custo e margem de vários produtos de uma vez (lista do catálogo), em duas consultas. */
export class CalculateRecipeCostsUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly products: readonly { readonly productId: string; readonly salePriceCents?: number | null }[]
  }): Promise<CalculateRecipeCostsResult> {
    const productIds = [...new Set(params.products.map((product) => product.productId))]
    const records = await this.dependencies.persistence.recipes.findByProducts({
      companyId: params.companyId,
      productIds,
    })
    const ingredients = await loadRecipeIngredients({
      dependencies: this.dependencies,
      companyId: params.companyId,
      records,
    })
    const recipesByProduct = new Map(records.map((record) => [record.recipe.productId, toRecipe(record)]))
    const costs = params.products.flatMap((product) => {
      const recipe = recipesByProduct.get(product.productId)
      if (!recipe) return []
      return [calculateRecipeCost({ recipe, ingredients, salePriceCents: product.salePriceCents ?? null })]
    })
    return { costs, productsWithoutRecipe: productIds.filter((productId) => !recipesByProduct.has(productId)) }
  }
}

export type LookupRecipesResult = { readonly recipes: readonly Recipe[]; readonly ingredients: readonly Ingredient[] }

/**
 * Fichas e os insumos delas, para o backend do host ou o `stock-module` (baixa por pedido com
 * `calculateIngredientNeedsExact`).
 */
export class LookupRecipesUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly productIds: readonly string[]
  }): Promise<LookupRecipesResult> {
    const records = await this.dependencies.persistence.recipes.findByProducts({
      companyId: params.companyId,
      productIds: [...new Set(params.productIds)],
    })
    const ingredients = await loadRecipeIngredients({
      dependencies: this.dependencies,
      companyId: params.companyId,
      records,
    })
    return { recipes: records.map(toRecipe), ingredients }
  }
}
