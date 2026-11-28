/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O estoque não tem cadastro de insumo nem ficha: os dois vêm do `recipe-module` (ou do host) por
 * estas portas, no mesmo formato que `recipe-module` já devolve.
 */

import type { ClockPort, Ingredient, LoggerPort, Recipe } from '@adatechnology/recipe-contracts'

import type { ExpiringBatch, MovementKind } from './stock.types'

export type { ClockPort, LoggerPort }

export type StockIngredient = Pick<Ingredient, 'id' | 'name' | 'unit'>

/** Implementação natural: `recipeModule.useCases.lookupRecipes` / `ingredients.findByIds`. */
export interface IngredientCatalogPort {
  findIngredients(params: {
    readonly companyId: string
    readonly ingredientIds: readonly string[]
  }): Promise<readonly StockIngredient[]>
}

export interface RecipeSourcePort {
  /** O mesmo formato de `LookupRecipesResult` do `recipe-module`. */
  lookup(params: {
    readonly companyId: string
    readonly productIds: readonly string[]
  }): Promise<{ readonly recipes: readonly Recipe[]; readonly ingredients: readonly StockIngredient[] }>
}

export type BelowMinimumEvent = {
  readonly companyId: string
  readonly ingredientId: string
  readonly quantity: string
  readonly minimumQuantity: string
}

export type StockHooks = {
  /** Nível cruzou o mínimo para baixo (avisa uma vez por cruzamento, não a cada saída). */
  readonly onBelowMinimum?: (event: BelowMinimumEvent) => void | Promise<void>
  /** Lotes vencendo na janela, por empresa, a cada rodada de `scanExpiringBatches`. */
  readonly onBatchesExpiring?: (event: {
    readonly companyId: string
    readonly batches: readonly ExpiringBatch[]
  }) => void | Promise<void>
  readonly onMovementsRecorded?: (event: {
    readonly companyId: string
    readonly actorId?: string
    readonly kinds: readonly MovementKind[]
    readonly ingredientIds: readonly string[]
  }) => void | Promise<void>
}

export const DEFAULT_STOCK_SCOPES = {
  read: ['stock:read'],
  write: ['stock:write'],
  service: ['stock:service'],
} as const

export type StockScopes = {
  readonly read?: readonly string[]
  readonly write?: readonly string[]
  readonly service?: readonly string[]
}

export type StockModuleConfig = {
  readonly scopes?: StockScopes
  /**
   * Liga o estoque por empresa. Ausente: ligado para todas. Desligado: rotas 404, baixa por pedido
   * vira `disabled` e `getLevels` devolve vazio (a lista de compras mostra a necessidade bruta).
   */
  readonly isEnabledForCompany?: (companyId: string) => boolean | Promise<boolean>
  /** Janela padrão do aviso de validade. Padrão: 7 dias. */
  readonly expiryAlertDays?: number
}
