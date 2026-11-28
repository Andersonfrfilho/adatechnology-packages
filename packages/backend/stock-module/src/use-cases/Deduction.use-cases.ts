/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Baixa por pedido através da ficha técnica: cada linha tem uma chave (`order:<id>:<linha>`) e a
 * mesma chave nunca baixa duas vezes — reenvio do pedido, retry do worker e dois cliques são seguros.
 */

import { calculateIngredientNeedsExact, type ExactIngredientNeed } from '@adatechnology/recipe-contracts'
import {
  DEDUCTION_STATUS,
  MOVEMENT_KIND,
  StockConfigMissingError,
  type DeductOrderData,
  type OrderDeductionResult,
  type OrderLineDeduction,
} from '@adatechnology/stock-contracts'

import type { ActorParams } from '../shared/actor'
import { isStockEnabled, notifyAfterCommit } from '../shared/stockContext'
import { applyLedgerChange, type LedgerResult } from '../shared/stockLedger'
import type { StockDependencies } from './stockModule.types'

export function orderLineSourceKey(params: { readonly orderId: string; readonly lineKey: string }): string {
  return `order:${params.orderId}:${params.lineKey}`
}

type LinePlan = { readonly lineKey: string; readonly sourceKey: string; readonly needs: readonly ExactIngredientNeed[] }

export class DeductOrderUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  private async planLines(params: {
    companyId: string
    input: DeductOrderData
  }): Promise<{ plans: LinePlan[]; productsWithoutRecipe: string[] }> {
    const source = this.dependencies.recipes
    if (!source) throw new StockConfigMissingError('providers.recipes')
    const productIds = [...new Set(params.input.lines.map((line) => line.productId))]
    const { recipes, ingredients } = await source.lookup({ companyId: params.companyId, productIds })
    const without = new Set<string>()
    const plans = params.input.lines.map((line) => {
      const exact = calculateIngredientNeedsExact({ items: [line], recipes, ingredients })
      for (const productId of exact.productsWithoutRecipe) without.add(productId)
      return {
        lineKey: line.lineKey,
        sourceKey: orderLineSourceKey({ orderId: params.input.orderId, lineKey: line.lineKey }),
        needs: exact.needs,
      }
    })
    return { plans, productsWithoutRecipe: [...without] }
  }

  async execute(params: ActorParams & { readonly input: DeductOrderData }): Promise<OrderDeductionResult> {
    const { input } = params
    if (!(await isStockEnabled(this.dependencies, params.companyId)))
      return {
        orderId: input.orderId,
        lines: input.lines.map((line) => ({
          lineKey: line.lineKey,
          status: DEDUCTION_STATUS.DISABLED,
          movementCount: 0,
        })),
        productsWithoutRecipe: [],
      }

    const { plans, productsWithoutRecipe } = await this.planLines({ companyId: params.companyId, input })
    const now = this.dependencies.clock.now()
    const results: LedgerResult[] = []
    const lines = await this.dependencies.persistence.stock.transaction(async (transaction) => {
      // Trava todos os níveis do pedido de uma vez, em ordem: dois pedidos nunca se cruzam (deadlock).
      const ingredientUnits = new Map(
        plans.flatMap((plan) => plan.needs.map((need) => [need.ingredientId, need.unit] as const)),
      )
      const levels = await transaction.lockLevels({
        companyId: params.companyId,
        ingredients: [...ingredientUnits].map(([id, unit]) => ({ id, unit })),
        now,
      })
      const current = new Map(levels)
      const outcome: OrderLineDeduction[] = []
      for (const plan of plans) {
        // Sequencial: a mesma transação, e cada linha depende do saldo deixado pela anterior.
        if (!(await transaction.claimSourceKey({ companyId: params.companyId, sourceKey: plan.sourceKey, now }))) {
          outcome.push({ lineKey: plan.lineKey, status: DEDUCTION_STATUS.ALREADY_APPLIED, movementCount: 0 })
          continue
        }
        let movementCount = 0
        for (const need of plan.needs) {
          const level = current.get(need.ingredientId)
          if (!level) continue
          const result = await applyLedgerChange({
            transaction,
            level,
            change: {
              companyId: params.companyId,
              ingredientId: need.ingredientId,
              delta: { numerator: -need.quantity.numerator, denominator: need.quantity.denominator },
              unit: need.unit,
              kind: MOVEMENT_KIND.OUT,
              reason: `Pedido ${input.orderId}`,
              actorId: params.actorId ?? null,
              sourceKey: plan.sourceKey,
              batch: { mode: 'fefo' },
              now,
            },
          })
          results.push(result)
          current.set(need.ingredientId, { ...level, quantity: result.after })
          movementCount += result.movementCount
        }
        outcome.push({ lineKey: plan.lineKey, status: DEDUCTION_STATUS.APPLIED, movementCount })
      }
      return outcome
    })
    await notifyAfterCommit({
      dependencies: this.dependencies,
      actor: params,
      results: collapseByIngredient(results),
      kinds: [MOVEMENT_KIND.OUT],
    })
    return { orderId: input.orderId, lines, productsWithoutRecipe }
  }
}

/** Várias linhas do mesmo insumo: o aviso de mínimo olha o saldo antes da primeira e depois da última. */
function collapseByIngredient(results: readonly LedgerResult[]): LedgerResult[] {
  const byIngredient = new Map<string, LedgerResult>()
  for (const result of results) {
    const first = byIngredient.get(result.ingredientId)
    byIngredient.set(
      result.ingredientId,
      first ? { ...result, before: first.before, movementCount: first.movementCount + result.movementCount } : result,
    )
  }
  return [...byIngredient.values()]
}
