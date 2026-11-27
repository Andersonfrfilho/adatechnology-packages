/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { RecipeUnit } from '@adatechnology/recipe-contracts'
import { and, asc, eq, inArray } from 'drizzle-orm'

import type { RecipeDatabase } from '../database.types'
import { recipeLines, recipes, type RecipeLineRow, type RecipeRow } from '../schema/schema'
import type {
  IngredientUsage,
  RecipeRecord,
  RecipeStorePort,
  SaveRecipeLineValues,
  SaveRecipeValues,
} from '../use-cases/recipeModule.types'

function groupLines(rows: readonly RecipeRow[], lines: readonly RecipeLineRow[]): RecipeRecord[] {
  const byRecipe = new Map<string, RecipeLineRow[]>()
  for (const line of lines) byRecipe.set(line.recipeId, [...(byRecipe.get(line.recipeId) ?? []), line])
  return rows.map((recipe) => ({ recipe, lines: byRecipe.get(recipe.id) ?? [] }))
}

export class RecipeRepository implements RecipeStorePort {
  constructor(private readonly db: RecipeDatabase) {}

  private async loadLines(recipeIds: readonly string[]): Promise<RecipeLineRow[]> {
    if (recipeIds.length === 0) return []
    return this.db
      .select()
      .from(recipeLines)
      .where(inArray(recipeLines.recipeId, [...recipeIds]))
      .orderBy(asc(recipeLines.recipeId), asc(recipeLines.position))
  }

  async findByProduct(params: { companyId: string; productId: string }): Promise<RecipeRecord | undefined> {
    const [record] = await this.findByProducts({ companyId: params.companyId, productIds: [params.productId] })
    return record
  }

  async findByProducts(params: { companyId: string; productIds: readonly string[] }): Promise<readonly RecipeRecord[]> {
    if (params.productIds.length === 0) return []
    const rows = await this.db
      .select()
      .from(recipes)
      .where(and(eq(recipes.companyId, params.companyId), inArray(recipes.productId, [...params.productIds])))
    return groupLines(rows, await this.loadLines(rows.map((row) => row.id)))
  }

  async save(params: {
    companyId: string
    productId: string
    values: SaveRecipeValues
    lines: readonly SaveRecipeLineValues[]
    now: Date
  }): Promise<{ record: RecipeRecord; isNew: boolean }> {
    return this.db.transaction(async (transaction) => {
      const [inserted] = await transaction
        .insert(recipes)
        .values({
          companyId: params.companyId,
          productId: params.productId,
          ...params.values,
          createdAt: params.now,
          updatedAt: params.now,
        })
        .onConflictDoNothing({ target: [recipes.companyId, recipes.productId] })
        .returning()
      const recipe =
        inserted ??
        (
          await transaction
            .update(recipes)
            .set({ ...params.values, updatedAt: params.now })
            .where(and(eq(recipes.companyId, params.companyId), eq(recipes.productId, params.productId)))
            .returning()
        )[0]
      if (!recipe) throw new Error('recipes: ficha sumiu durante a gravação')

      await transaction.delete(recipeLines).where(eq(recipeLines.recipeId, recipe.id))
      const lines =
        params.lines.length === 0
          ? []
          : await transaction
              .insert(recipeLines)
              .values(
                params.lines.map((line) => ({
                  ...line,
                  companyId: params.companyId,
                  recipeId: recipe.id,
                  createdAt: params.now,
                  updatedAt: params.now,
                })),
              )
              .returning()
      return { record: { recipe, lines }, isNew: inserted !== undefined }
    })
  }

  async remove(params: { companyId: string; productId: string }): Promise<boolean> {
    const removed = await this.db
      .delete(recipes)
      .where(and(eq(recipes.companyId, params.companyId), eq(recipes.productId, params.productId)))
      .returning({ id: recipes.id })
    return removed.length > 0
  }

  async findUsages(params: {
    companyId: string
    ingredientId: string
    limit: number
  }): Promise<readonly IngredientUsage[]> {
    const rows = await this.db
      .select({ productId: recipes.productId, unit: recipeLines.unit })
      .from(recipeLines)
      .innerJoin(recipes, eq(recipes.id, recipeLines.recipeId))
      .where(and(eq(recipeLines.companyId, params.companyId), eq(recipeLines.ingredientId, params.ingredientId)))
      .limit(params.limit)
    return rows.map((row) => ({ productId: row.productId, unit: row.unit as RecipeUnit }))
  }
}
