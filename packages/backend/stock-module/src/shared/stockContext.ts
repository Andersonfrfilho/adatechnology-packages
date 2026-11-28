/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import {
  StockDisabledError,
  StockIngredientNotFoundError,
  type MovementKind,
  type StockIngredient,
} from '@adatechnology/stock-contracts'

import type { StockDependencies } from '../use-cases/stockModule.types'
import { actor, type ActorParams } from './actor'
import { crossedBelowMinimum, type LedgerResult } from './stockLedger'
import { runHook } from './runHook'

export async function isStockEnabled(dependencies: StockDependencies, companyId: string): Promise<boolean> {
  return (await dependencies.config.isEnabledForCompany?.(companyId)) ?? true
}

export async function assertStockEnabled(dependencies: StockDependencies, companyId: string): Promise<void> {
  if (!(await isStockEnabled(dependencies, companyId))) throw new StockDisabledError()
}

export async function loadIngredients(params: {
  readonly dependencies: StockDependencies
  readonly companyId: string
  readonly ingredientIds: readonly string[]
}): Promise<Map<string, StockIngredient>> {
  const ids = [...new Set(params.ingredientIds)]
  if (ids.length === 0) return new Map()
  const found = await params.dependencies.catalog.findIngredients({ companyId: params.companyId, ingredientIds: ids })
  return new Map(found.map((ingredient) => [ingredient.id, ingredient]))
}

/** Insumo do catálogo da empresa (BOLA: id de outra empresa = 404). */
export async function requireIngredient(params: {
  readonly dependencies: StockDependencies
  readonly companyId: string
  readonly ingredientId: string
}): Promise<StockIngredient> {
  const ingredients = await loadIngredients({ ...params, ingredientIds: [params.ingredientId] })
  const ingredient = ingredients.get(params.ingredientId)
  if (!ingredient) throw new StockIngredientNotFoundError(params.ingredientId)
  return ingredient
}

/** Depois do commit: aviso de mínimo (uma vez por cruzamento) e trilha dos movimentos. */
export async function notifyAfterCommit(params: {
  readonly dependencies: StockDependencies
  readonly actor: ActorParams
  readonly results: readonly LedgerResult[]
  readonly kinds: readonly MovementKind[]
}): Promise<void> {
  const { dependencies, results } = params
  const companyId = params.actor.companyId
  const crossed = results.filter(crossedBelowMinimum)
  await Promise.all(
    crossed.map((result) =>
      runHook({
        name: 'onBelowMinimum',
        logger: dependencies.logger,
        meta: { companyId, ingredientId: result.ingredientId },
        run: () =>
          dependencies.hooks?.onBelowMinimum?.({
            companyId,
            ingredientId: result.ingredientId,
            quantity: result.after,
            minimumQuantity: result.minimumQuantity ?? '0',
          }),
      }),
    ),
  )
  if (results.length === 0) return
  await runHook({
    name: 'onMovementsRecorded',
    logger: dependencies.logger,
    meta: { companyId },
    run: () =>
      dependencies.hooks?.onMovementsRecorded?.({
        ...actor(params.actor),
        kinds: [...new Set(params.kinds)],
        ingredientIds: [...new Set(results.map((result) => result.ingredientId))],
      }),
  })
}
