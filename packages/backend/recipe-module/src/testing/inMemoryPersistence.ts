/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublê em memória com as mesmas regras do banco (empresa, FK RESTRICT, ficha única por produto):
 * serve aos testes do módulo e aos do host.
 */

import {
  compare,
  parseDecimal,
  type IngredientFilters,
  type ListIngredientsQuery,
} from '@adatechnology/recipe-contracts'

import type { IngredientRow, NewIngredientRow, RecipeLineRow, RecipeRow } from '../schema/schema'
import {
  REMOVE_RESULT,
  type IngredientStorePort,
  type IngredientUsage,
  type Page,
  type RecipePersistence,
  type RecipeRecord,
  type RecipeStorePort,
  type RemoveResult,
  type SaveRecipeLineValues,
  type SaveRecipeValues,
} from '../use-cases/recipeModule.types'
import type { RecipeUnit } from '@adatechnology/recipe-contracts'

export type InMemoryState = {
  readonly ingredients: Map<string, IngredientRow>
  readonly recipes: Map<string, RecipeRow>
  readonly lines: Map<string, RecipeLineRow>
}

function compareRows(sort: IngredientFilters['sort'], left: IngredientRow, right: IngredientRow): number {
  if (sort === 'costPerUnit') return compare(parseDecimal(left.costPerUnit), parseDecimal(right.costPerUnit))
  if (sort === 'updatedAt') return left.updatedAt.getTime() - right.updatedAt.getTime()
  return left[sort].localeCompare(right[sort], 'pt-BR')
}

function matches(row: IngredientRow, params: IngredientFilters & { companyId: string }): boolean {
  if (row.companyId !== params.companyId) return false
  if (params.unit?.length && !params.unit.includes(row.unit as RecipeUnit)) return false
  if (!params.search) return true
  const search = params.search.toLocaleLowerCase('pt-BR')
  return [row.name, row.supplier ?? ''].some((value) => value.toLocaleLowerCase('pt-BR').includes(search))
}

class InMemoryIngredientStore implements IngredientStorePort {
  constructor(private readonly state: InMemoryState) {}

  async insert(values: NewIngredientRow): Promise<IngredientRow> {
    const now = new Date()
    const row: IngredientRow = {
      id: values.id ?? crypto.randomUUID(),
      companyId: values.companyId,
      name: values.name,
      unit: values.unit,
      costPerUnit: values.costPerUnit ?? '0.0000',
      supplier: values.supplier ?? null,
      notes: values.notes ?? null,
      createdAt: values.createdAt ?? now,
      updatedAt: values.updatedAt ?? now,
    }
    this.state.ingredients.set(row.id, row)
    return row
  }

  async update(params: {
    companyId: string
    id: string
    values: Partial<NewIngredientRow>
  }): Promise<IngredientRow | undefined> {
    const current = await this.findById(params)
    if (!current) return undefined
    const row = { ...current, ...params.values } as IngredientRow
    this.state.ingredients.set(row.id, row)
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<IngredientRow | undefined> {
    const row = this.state.ingredients.get(params.id)
    return row?.companyId === params.companyId ? row : undefined
  }

  async findByIds(params: { companyId: string; ids: readonly string[] }): Promise<readonly IngredientRow[]> {
    return params.ids.flatMap((id) => {
      const row = this.state.ingredients.get(id)
      return row?.companyId === params.companyId ? [row] : []
    })
  }

  private filtered(params: IngredientFilters & { companyId: string }): IngredientRow[] {
    const direction = params.order === 'asc' ? 1 : -1
    return [...this.state.ingredients.values()]
      .filter((row) => matches(row, params))
      .sort((left, right) => direction * compareRows(params.sort, left, right) || left.id.localeCompare(right.id))
  }

  async list(params: ListIngredientsQuery & { companyId: string }): Promise<Page<IngredientRow>> {
    const rows = this.filtered(params)
    const start = (params.page - 1) * params.pageSize
    return { rows: rows.slice(start, start + params.pageSize), total: rows.length }
  }

  async listForExport(params: {
    companyId: string
    filters: IngredientFilters
    limit: number
  }): Promise<Page<IngredientRow>> {
    const rows = this.filtered({ ...params.filters, companyId: params.companyId })
    return { rows: rows.slice(0, params.limit), total: rows.length }
  }

  async remove(params: { companyId: string; id: string }): Promise<RemoveResult> {
    if (!(await this.findById(params))) return REMOVE_RESULT.NOT_FOUND
    const inUse = [...this.state.lines.values()].some((line) => line.ingredientId === params.id)
    if (inUse) return REMOVE_RESULT.IN_USE
    this.state.ingredients.delete(params.id)
    return REMOVE_RESULT.REMOVED
  }
}

class InMemoryRecipeStore implements RecipeStorePort {
  constructor(private readonly state: InMemoryState) {}

  private record(recipe: RecipeRow): RecipeRecord {
    const lines = [...this.state.lines.values()]
      .filter((line) => line.recipeId === recipe.id)
      .sort((left, right) => left.position - right.position)
    return { recipe, lines }
  }

  private find(companyId: string, productId: string): RecipeRow | undefined {
    return [...this.state.recipes.values()].find((row) => row.companyId === companyId && row.productId === productId)
  }

  async findByProduct(params: { companyId: string; productId: string }): Promise<RecipeRecord | undefined> {
    const recipe = this.find(params.companyId, params.productId)
    return recipe ? this.record(recipe) : undefined
  }

  async findByProducts(params: { companyId: string; productIds: readonly string[] }): Promise<readonly RecipeRecord[]> {
    return params.productIds.flatMap((productId) => {
      const recipe = this.find(params.companyId, productId)
      return recipe ? [this.record(recipe)] : []
    })
  }

  async save(params: {
    companyId: string
    productId: string
    values: SaveRecipeValues
    lines: readonly SaveRecipeLineValues[]
    now: Date
  }): Promise<{ record: RecipeRecord; isNew: boolean }> {
    for (const line of params.lines) {
      const ingredient = this.state.ingredients.get(line.ingredientId)
      if (ingredient?.companyId !== params.companyId) throw Object.assign(new Error('fk'), { code: '23503' })
    }
    const existing = this.find(params.companyId, params.productId)
    const recipe: RecipeRow = {
      id: existing?.id ?? crypto.randomUUID(),
      companyId: params.companyId,
      productId: params.productId,
      ...params.values,
      createdAt: existing?.createdAt ?? params.now,
      updatedAt: params.now,
    }
    this.state.recipes.set(recipe.id, recipe)
    for (const line of [...this.state.lines.values()]) if (line.recipeId === recipe.id) this.state.lines.delete(line.id)
    for (const line of params.lines)
      this.state.lines.set(line.id, {
        ...line,
        companyId: params.companyId,
        recipeId: recipe.id,
        createdAt: params.now,
        updatedAt: params.now,
      })
    return { record: this.record(recipe), isNew: existing === undefined }
  }

  async remove(params: { companyId: string; productId: string }): Promise<boolean> {
    const recipe = this.find(params.companyId, params.productId)
    if (!recipe) return false
    this.state.recipes.delete(recipe.id)
    for (const line of [...this.state.lines.values()]) if (line.recipeId === recipe.id) this.state.lines.delete(line.id)
    return true
  }

  async findUsages(params: {
    companyId: string
    ingredientId: string
    limit: number
  }): Promise<readonly IngredientUsage[]> {
    return [...this.state.lines.values()]
      .filter((line) => line.companyId === params.companyId && line.ingredientId === params.ingredientId)
      .slice(0, params.limit)
      .map((line) => ({
        productId: this.state.recipes.get(line.recipeId)?.productId ?? '',
        unit: line.unit as RecipeUnit,
      }))
  }
}

export function createInMemoryRecipePersistence(
  state?: InMemoryState,
): RecipePersistence & { readonly state: InMemoryState } {
  const resolved = state ?? { ingredients: new Map(), recipes: new Map(), lines: new Map() }
  return {
    state: resolved,
    ingredients: new InMemoryIngredientStore(resolved),
    recipes: new InMemoryRecipeStore(resolved),
  }
}
