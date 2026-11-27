/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas que o host implementa. Todas opcionais: sem elas o módulo funciona sozinho (lista de compras
 * mostra a necessidade bruta; produto não é conferido no catálogo).
 */

import type { ExportFormat } from './schemas'
import type { Ingredient, Recipe, StockLevel } from './recipe.types'

export type LogMeta = Readonly<Record<string, unknown>>

export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export interface ClockPort {
  now(): Date
}

/**
 * Estoque atual por insumo, na unidade do insumo. Implementada pelo `stock-module` (ou pelo
 * estoque próprio do host). Insumo ausente na resposta conta como sem estoque informado.
 */
export interface StockLevelPort {
  getLevels(params: {
    readonly companyId: string
    readonly ingredientIds: readonly string[]
  }): Promise<readonly StockLevel[]>
}

/** Confere que o produto existe no catálogo da empresa antes de gravar a ficha. */
export interface ProductReferencePort {
  /** Devolve só os ids que existem e pertencem à empresa. */
  findExisting(params: {
    readonly companyId: string
    readonly productIds: readonly string[]
  }): Promise<readonly string[]>
}

export type ExportKind = 'ingredients' | 'shopping-list'

export type ExportedEvent = {
  readonly companyId: string
  readonly actorId?: string
  readonly kind: ExportKind
  readonly format: ExportFormat
  readonly rowCount: number
}

/**
 * Ganchos depois da escrita confirmada (espelhar no host, auditoria). Erro no gancho é logado e não
 * desfaz a gravação: o host que espelha dados deve reconciliar (ver README).
 */
export type RecipeHooks = {
  readonly onIngredientSaved?: (event: {
    readonly companyId: string
    readonly actorId?: string
    readonly ingredient: Ingredient
    readonly isNew: boolean
  }) => void | Promise<void>
  readonly onIngredientRemoved?: (event: {
    readonly companyId: string
    readonly actorId?: string
    readonly ingredientId: string
  }) => void | Promise<void>
  readonly onRecipeSaved?: (event: {
    readonly companyId: string
    readonly actorId?: string
    readonly recipe: Recipe
    readonly isNew: boolean
  }) => void | Promise<void>
  readonly onRecipeRemoved?: (event: {
    readonly companyId: string
    readonly actorId?: string
    readonly productId: string
  }) => void | Promise<void>
  readonly onExported?: (event: ExportedEvent) => void | Promise<void>
}

export const DEFAULT_RECIPE_SCOPES = {
  read: ['recipes:read'],
  write: ['recipes:write'],
  service: ['recipes:service'],
} as const

export type RecipeScopes = {
  /** Ler insumos, fichas, custos e lista de compras. Quem escreve também lê. */
  readonly read?: readonly string[]
  /** Criar, alterar e apagar insumos e fichas. */
  readonly write?: readonly string[]
  /** Backend do host (ou `stock-module`) buscando fichas em lote. */
  readonly service?: readonly string[]
}

export type RecipeModuleConfig = {
  readonly scopes?: RecipeScopes
  /** Teto de linhas por exportação. Padrão: 10.000. */
  readonly exportRowLimit?: number
}
