/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  areUnitsCompatible,
  IngredientInUseError,
  IngredientNotFoundError,
  UnitChangeInUseError,
  type CreateIngredientData,
  type ExportIngredientsQuery,
  type Ingredient,
  type ListIngredientsQuery,
  type Paginated,
  type UpdateIngredientData,
} from '@adatechnology/recipe-contracts'

import { actor, type ActorParams } from '../shared/actor'
import { buildExportFile, DEFAULT_EXPORT_ROW_LIMIT, type ExportResult } from '../shared/exportFile'
import { runHook } from '../shared/runHook'
import { toIngredient, toPaginated } from '../shared/toContract'
import { REMOVE_RESULT, type RecipeDependencies } from './recipeModule.types'

const USAGE_SAMPLE = 1_000
const PRODUCTS_IN_ERROR = 20

export type IngredientActorParams = ActorParams

function uniqueProducts(usages: readonly { productId: string }[]): string[] {
  return [...new Set(usages.map((usage) => usage.productId))].slice(0, PRODUCTS_IN_ERROR)
}

export class CreateIngredientUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: IngredientActorParams & { readonly input: CreateIngredientData }): Promise<Ingredient> {
    const now = this.dependencies.clock.now()
    const row = await this.dependencies.persistence.ingredients.insert({
      companyId: params.companyId,
      ...params.input,
      createdAt: now,
      updatedAt: now,
    })
    const ingredient = toIngredient(row)
    await runHook({
      name: 'onIngredientSaved',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, ingredientId: ingredient.id },
      run: () => this.dependencies.hooks?.onIngredientSaved?.({ ...actor(params), ingredient, isNew: true }),
    })
    return ingredient
  }
}

export class UpdateIngredientUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  private async assertUnitChangeAllowed(params: {
    companyId: string
    id: string
    unit: Ingredient['unit']
  }): Promise<void> {
    const usages = await this.dependencies.persistence.recipes.findUsages({
      companyId: params.companyId,
      ingredientId: params.id,
      limit: USAGE_SAMPLE,
    })
    const broken = usages.filter((usage) => !areUnitsCompatible(usage.unit, params.unit))
    if (broken.length > 0)
      throw new UnitChangeInUseError({ ingredientId: params.id, productIds: uniqueProducts(broken) })
  }

  async execute(
    params: IngredientActorParams & { readonly id: string; readonly input: UpdateIngredientData },
  ): Promise<Ingredient> {
    const { persistence } = this.dependencies
    const current = await persistence.ingredients.findById({ companyId: params.companyId, id: params.id })
    if (!current) throw new IngredientNotFoundError(params.id)
    if (params.input.unit && params.input.unit !== current.unit)
      await this.assertUnitChangeAllowed({ companyId: params.companyId, id: params.id, unit: params.input.unit })

    const row = await persistence.ingredients.update({
      companyId: params.companyId,
      id: params.id,
      values: { ...params.input, updatedAt: this.dependencies.clock.now() },
    })
    if (!row) throw new IngredientNotFoundError(params.id)
    const ingredient = toIngredient(row)
    await runHook({
      name: 'onIngredientSaved',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, ingredientId: ingredient.id },
      run: () => this.dependencies.hooks?.onIngredientSaved?.({ ...actor(params), ingredient, isNew: false }),
    })
    return ingredient
  }
}

export class GetIngredientUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: { readonly companyId: string; readonly id: string }): Promise<Ingredient> {
    const row = await this.dependencies.persistence.ingredients.findById(params)
    if (!row) throw new IngredientNotFoundError(params.id)
    return toIngredient(row)
  }
}

/** Vários insumos por id, da empresa (porta de catálogo do `stock-module`). Id de outra empresa some. */
export class FindIngredientsUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly ingredientIds: readonly string[]
  }): Promise<Ingredient[]> {
    const ids = [...new Set(params.ingredientIds)]
    const rows = await this.dependencies.persistence.ingredients.findByIds({ companyId: params.companyId, ids })
    return rows.map(toIngredient)
  }
}

export class ListIngredientsUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly query: ListIngredientsQuery
  }): Promise<Paginated<Ingredient>> {
    const page = await this.dependencies.persistence.ingredients.list({ ...params.query, companyId: params.companyId })
    return toPaginated({ ...page, page: params.query.page, pageSize: params.query.pageSize, map: toIngredient })
  }
}

export class RemoveIngredientUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: IngredientActorParams & { readonly id: string }): Promise<void> {
    const { persistence } = this.dependencies
    const result = await persistence.ingredients.remove({ companyId: params.companyId, id: params.id })
    if (result === REMOVE_RESULT.NOT_FOUND) throw new IngredientNotFoundError(params.id)
    if (result === REMOVE_RESULT.IN_USE) {
      const usages = await persistence.recipes.findUsages({
        companyId: params.companyId,
        ingredientId: params.id,
        limit: USAGE_SAMPLE,
      })
      throw new IngredientInUseError({ ingredientId: params.id, productIds: uniqueProducts(usages) })
    }
    await runHook({
      name: 'onIngredientRemoved',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, ingredientId: params.id },
      run: () => this.dependencies.hooks?.onIngredientRemoved?.({ ...actor(params), ingredientId: params.id }),
    })
  }
}

export const INGREDIENT_EXPORT_HEADER = [
  'Nome',
  'Unidade',
  'Custo por unidade',
  'Fornecedor',
  'Observações',
  'Atualizado em',
] as const

export class ExportIngredientsUseCase {
  constructor(private readonly dependencies: RecipeDependencies) {}

  async execute(params: IngredientActorParams & { readonly query: ExportIngredientsQuery }): Promise<ExportResult> {
    const { format, ...filters } = params.query
    const limit = this.dependencies.config.exportRowLimit ?? DEFAULT_EXPORT_ROW_LIMIT
    const page = await this.dependencies.persistence.ingredients.listForExport({
      companyId: params.companyId,
      filters,
      limit,
    })
    const now = this.dependencies.clock.now()
    const file = buildExportFile({
      table: {
        header: INGREDIENT_EXPORT_HEADER,
        rows: page.rows
          .map(toIngredient)
          .map((ingredient) => [
            ingredient.name,
            ingredient.unit,
            Number(ingredient.costPerUnit),
            ingredient.supplier,
            ingredient.notes,
            ingredient.updatedAt,
          ]),
      },
      format,
      baseName: 'insumos',
      now,
      isTruncated: page.total > page.rows.length,
    })
    await runHook({
      name: 'onExported',
      logger: this.dependencies.logger,
      meta: { companyId: params.companyId, kind: 'ingredients' },
      run: () =>
        this.dependencies.hooks?.onExported?.({
          ...actor(params),
          kind: 'ingredients',
          format,
          rowCount: file.rowCount,
        }),
    })
    return file
  }
}
