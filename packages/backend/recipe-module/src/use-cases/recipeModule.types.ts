/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas de persistência: o Drizzle e o dublê em memória implementam as mesmas, e os use cases só
 * conhecem estas interfaces.
 */

import type {
  ClockPort,
  IngredientFilters,
  ListIngredientsQuery,
  LoggerPort,
  ProductReferencePort,
  RecipeHooks,
  RecipeModuleConfig,
  RecipeUnit,
  StockLevelPort,
} from '@adatechnology/recipe-contracts'

import type { IngredientRow, NewIngredientRow, RecipeLineRow, RecipeRow } from '../schema/schema'

export type Page<TRow> = { readonly rows: readonly TRow[]; readonly total: number }

export type RecipeRecord = { readonly recipe: RecipeRow; readonly lines: readonly RecipeLineRow[] }

export const REMOVE_RESULT = { REMOVED: 'removed', NOT_FOUND: 'not_found', IN_USE: 'in_use' } as const
export type RemoveResult = (typeof REMOVE_RESULT)[keyof typeof REMOVE_RESULT]

export type IngredientUsage = { readonly productId: string; readonly unit: RecipeUnit }

export interface IngredientStorePort {
  insert(values: NewIngredientRow): Promise<IngredientRow>
  update(params: {
    readonly companyId: string
    readonly id: string
    readonly values: Partial<NewIngredientRow>
  }): Promise<IngredientRow | undefined>
  findById(params: { readonly companyId: string; readonly id: string }): Promise<IngredientRow | undefined>
  findByIds(params: { readonly companyId: string; readonly ids: readonly string[] }): Promise<readonly IngredientRow[]>
  list(params: ListIngredientsQuery & { readonly companyId: string }): Promise<Page<IngredientRow>>
  listForExport(params: {
    readonly companyId: string
    readonly filters: IngredientFilters
    readonly limit: number
  }): Promise<Page<IngredientRow>>
  /** Recusa (`in_use`) se alguma linha de ficha aponta para o insumo. */
  remove(params: { readonly companyId: string; readonly id: string }): Promise<RemoveResult>
}

export type SaveRecipeValues = {
  readonly yieldPortions: string
  readonly preparationTimeMinutes: number | null
  readonly instructions: string
}

export type SaveRecipeLineValues = {
  readonly id: string
  readonly ingredientId: string
  readonly quantity: string
  readonly unit: RecipeUnit
  readonly notes: string | null
  readonly position: number
}

export interface RecipeStorePort {
  findByProduct(params: { readonly companyId: string; readonly productId: string }): Promise<RecipeRecord | undefined>
  findByProducts(params: {
    readonly companyId: string
    readonly productIds: readonly string[]
  }): Promise<readonly RecipeRecord[]>
  /** Grava cabeçalho e troca todas as linhas numa transação; cria se não existir. */
  save(params: {
    readonly companyId: string
    readonly productId: string
    readonly values: SaveRecipeValues
    readonly lines: readonly SaveRecipeLineValues[]
    readonly now: Date
  }): Promise<{ readonly record: RecipeRecord; readonly isNew: boolean }>
  remove(params: { readonly companyId: string; readonly productId: string }): Promise<boolean>
  findUsages(params: {
    readonly companyId: string
    readonly ingredientId: string
    readonly limit: number
  }): Promise<readonly IngredientUsage[]>
}

export type RecipePersistence = {
  readonly ingredients: IngredientStorePort
  readonly recipes: RecipeStorePort
}

export type RecipeDependencies = {
  readonly persistence: RecipePersistence
  readonly config: RecipeModuleConfig
  readonly clock: ClockPort
  readonly hooks?: RecipeHooks
  readonly logger?: LoggerPort
  readonly stockLevels?: StockLevelPort
  readonly productReference?: ProductReferencePort
}
