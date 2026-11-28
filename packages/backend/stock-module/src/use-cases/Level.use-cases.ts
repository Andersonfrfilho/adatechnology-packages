/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  convertQuantity,
  formatDecimal,
  parseDecimal,
  type Paginated,
  type RecipeUnit,
  type StockLevel,
  type StockLevelPort,
} from '@adatechnology/recipe-contracts'
import { StockIncompatibleUnitError, type ListLevelsQuery, type StockLevelView } from '@adatechnology/stock-contracts'

import { assertStockEnabled, isStockEnabled, loadIngredients, requireIngredient } from '../shared/stockContext'
import { inIngredientUnit, toLevelView, toPaginated } from '../shared/toContract'
import type { StockDependencies } from './stockModule.types'

/** Implementa o `StockLevelPort` do `recipe-module`: saldo na unidade atual de cada insumo. */
export class GetStockLevelsUseCase implements StockLevelPort {
  constructor(private readonly dependencies: StockDependencies) {}

  async getLevels(params: {
    readonly companyId: string
    readonly ingredientIds: readonly string[]
  }): Promise<readonly StockLevel[]> {
    // Desligado: vazio, e a lista de compras da ficha mostra a necessidade bruta.
    if (!(await isStockEnabled(this.dependencies, params.companyId))) return []
    const [rows, ingredients] = await Promise.all([
      this.dependencies.persistence.stock.findLevels(params),
      loadIngredients({ dependencies: this.dependencies, ...params }),
    ])
    return rows.map((row) => {
      const ingredient = ingredients.get(row.ingredientId)
      return {
        ingredientId: row.ingredientId,
        quantity: inIngredientUnit({ value: row.quantity, from: row.unit, ...(ingredient ? { ingredient } : {}) })
          .value,
      }
    })
  }
}

export class ListStockLevelsUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly query: ListLevelsQuery
  }): Promise<Paginated<StockLevelView>> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const page = await this.dependencies.persistence.stock.listLevels({
      companyId: params.companyId,
      page: params.query.page,
      pageSize: params.query.pageSize,
      ...(params.query.belowMinimum !== undefined ? { belowMinimum: params.query.belowMinimum } : {}),
    })
    const ingredients = await loadIngredients({
      dependencies: this.dependencies,
      companyId: params.companyId,
      ingredientIds: page.rows.map((row) => row.ingredientId),
    })
    return toPaginated({
      ...page,
      page: params.query.page,
      pageSize: params.query.pageSize,
      map: (row) => toLevelView(row, ingredients.get(row.ingredientId)),
    })
  }
}

export class GetStockLevelUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: { readonly companyId: string; readonly ingredientId: string }): Promise<StockLevelView> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const ingredient = await requireIngredient({ dependencies: this.dependencies, ...params })
    const [row] = await this.dependencies.persistence.stock.findLevels({
      companyId: params.companyId,
      ingredientIds: [ingredient.id],
    })
    if (row) return toLevelView(row, ingredient)
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
      quantity: '0.0000',
      minimumQuantity: null,
      isBelowMinimum: false,
      updatedAt: this.dependencies.clock.now().toISOString(),
    }
  }
}

export class SetMinimumUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly ingredientId: string
    /** Na unidade atual do insumo; `null` tira o mínimo. */
    readonly minimumQuantity: string | null
  }): Promise<StockLevelView> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const ingredient = await requireIngredient({ dependencies: this.dependencies, ...params })
    const [current] = await this.dependencies.persistence.stock.findLevels({
      companyId: params.companyId,
      ingredientIds: [ingredient.id],
    })
    const levelUnit = (current?.unit ?? ingredient.unit) as RecipeUnit
    let minimum: string | null = null
    if (params.minimumQuantity !== null) {
      const converted = convertQuantity({
        quantity: parseDecimal(params.minimumQuantity),
        from: ingredient.unit,
        to: levelUnit,
      })
      if (!converted) throw new StockIncompatibleUnitError({ unit: ingredient.unit, ingredientUnit: levelUnit })
      minimum = formatDecimal(converted)
    }
    const row = await this.dependencies.persistence.stock.upsertMinimum({
      companyId: params.companyId,
      ingredientId: ingredient.id,
      unit: levelUnit,
      minimumQuantity: minimum,
      now: this.dependencies.clock.now(),
    })
    return toLevelView(row, ingredient)
  }
}
