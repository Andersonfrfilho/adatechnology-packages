/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import type { IngredientFilters, ListIngredientsQuery } from '@adatechnology/recipe-contracts'
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'

import type { RecipeDatabase } from '../database.types'
import { ingredients, recipeLines, type IngredientRow, type NewIngredientRow } from '../schema/schema'
import { isForeignKeyViolation, likePattern } from '../shared/postgresErrors'
import { REMOVE_RESULT, type IngredientStorePort, type Page, type RemoveResult } from '../use-cases/recipeModule.types'

const SORT_COLUMNS = {
  name: ingredients.name,
  unit: ingredients.unit,
  costPerUnit: ingredients.costPerUnit,
  updatedAt: ingredients.updatedAt,
} as const

function owned(params: { companyId: string; id: string }): SQL {
  return and(eq(ingredients.companyId, params.companyId), eq(ingredients.id, params.id)) as SQL
}

function filterCondition(params: IngredientFilters & { companyId: string }): SQL {
  const conditions: SQL[] = [eq(ingredients.companyId, params.companyId)]
  if (params.search) {
    const pattern = likePattern(params.search)
    conditions.push(sql`(${ingredients.name} ilike ${pattern} or ${ingredients.supplier} ilike ${pattern})`)
  }
  if (params.unit?.length) conditions.push(inArray(ingredients.unit, params.unit))
  return and(...conditions) as SQL
}

export class IngredientRepository implements IngredientStorePort {
  constructor(private readonly db: RecipeDatabase) {}

  async insert(values: NewIngredientRow): Promise<IngredientRow> {
    const [row] = await this.db.insert(ingredients).values(values).returning()
    return row as IngredientRow
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewIngredientRow>
  }): Promise<IngredientRow | undefined> {
    const [row] = await this.db.update(ingredients).set(params.values).where(owned(params)).returning()
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<IngredientRow | undefined> {
    const [row] = await this.db.select().from(ingredients).where(owned(params)).limit(1)
    return row
  }

  async findByIds(params: { companyId: string; ids: readonly string[] }): Promise<readonly IngredientRow[]> {
    if (params.ids.length === 0) return []
    return this.db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.companyId, params.companyId), inArray(ingredients.id, [...params.ids])))
  }

  private async page(params: {
    where: SQL
    sort: ListIngredientsQuery['sort']
    order: ListIngredientsQuery['order']
    limit: number
    offset: number
  }): Promise<Page<IngredientRow>> {
    const column = SORT_COLUMNS[params.sort]
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(ingredients)
        .where(params.where)
        .orderBy(params.order === 'asc' ? asc(column) : desc(column), asc(ingredients.id))
        .limit(params.limit)
        .offset(params.offset),
      this.db.select({ total: count() }).from(ingredients).where(params.where),
    ])
    return { rows, total: totals[0]?.total ?? 0 }
  }

  list(params: ListIngredientsQuery & { companyId: string }): Promise<Page<IngredientRow>> {
    return this.page({
      where: filterCondition(params),
      sort: params.sort,
      order: params.order,
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
    })
  }

  listForExport(params: {
    companyId: string
    filters: IngredientFilters
    limit: number
  }): Promise<Page<IngredientRow>> {
    return this.page({
      where: filterCondition({ ...params.filters, companyId: params.companyId }),
      sort: params.filters.sort,
      order: params.filters.order,
      limit: params.limit,
      offset: 0,
    })
  }

  async remove(params: { companyId: string; id: string }): Promise<RemoveResult> {
    const [usage] = await this.db
      .select({ id: recipeLines.id })
      .from(recipeLines)
      .where(and(eq(recipeLines.companyId, params.companyId), eq(recipeLines.ingredientId, params.id)))
      .limit(1)
    if (usage) return REMOVE_RESULT.IN_USE
    try {
      const removed = await this.db.delete(ingredients).where(owned(params)).returning({ id: ingredients.id })
      return removed.length > 0 ? REMOVE_RESULT.REMOVED : REMOVE_RESULT.NOT_FOUND
    } catch (error) {
      // Linha criada entre a checagem e o DELETE: a FK RESTRICT decide.
      if (isForeignKeyViolation(error)) return REMOVE_RESULT.IN_USE
      throw error
    }
  }
}
