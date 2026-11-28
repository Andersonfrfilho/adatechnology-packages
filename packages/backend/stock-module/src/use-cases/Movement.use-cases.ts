/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { parseDecimal, type Paginated, type Rational, type RecipeUnit } from '@adatechnology/recipe-contracts'
import {
  ADJUST_DIRECTION,
  MOVEMENT_KIND,
  type AdjustStockData,
  type ListBatchesQuery,
  type ListMovementsQuery,
  type MovementKind,
  type ReceiveBatchData,
  type RecordLossData,
  type StockBatch,
  type StockLevelView,
  type StockMovement,
} from '@adatechnology/stock-contracts'

import type { ActorParams } from '../shared/actor'
import { assertStockEnabled, notifyAfterCommit, requireIngredient } from '../shared/stockContext'
import { applyLedgerChange, type BatchMode } from '../shared/stockLedger'
import { toBatch, toLevelView, toMovement, toPaginated } from '../shared/toContract'
import type { StockDependencies } from './stockModule.types'

const DAY_MS = 86_400_000

type SingleChange = {
  readonly ingredientId: string
  readonly delta: Rational
  readonly unit: RecipeUnit | undefined
  readonly kind: MovementKind
  readonly reason: string
  readonly batch: BatchMode
}

/** Uma mudança num insumo: trava o nível, aplica, avisa depois do commit. */
async function recordSingleChange(params: {
  readonly dependencies: StockDependencies
  readonly actor: ActorParams
  readonly change: SingleChange
}): Promise<StockLevelView> {
  const { dependencies, change } = params
  const companyId = params.actor.companyId
  await assertStockEnabled(dependencies, companyId)
  const ingredient = await requireIngredient({ dependencies, companyId, ingredientId: change.ingredientId })
  const now = dependencies.clock.now()
  const result = await dependencies.persistence.stock.transaction(async (transaction) => {
    const locked = await transaction.lockLevels({ companyId, ingredients: [ingredient], now })
    const level = locked.get(ingredient.id)
    if (!level) throw new Error('stock: nível não travado')
    return applyLedgerChange({
      transaction,
      level,
      change: {
        companyId,
        ingredientId: ingredient.id,
        delta: change.delta,
        unit: change.unit ?? ingredient.unit,
        kind: change.kind,
        reason: change.reason,
        actorId: params.actor.actorId ?? null,
        sourceKey: null,
        batch: change.batch,
        now,
      },
    })
  })
  await notifyAfterCommit({ dependencies, actor: params.actor, results: [result], kinds: [change.kind] })
  const [row] = await dependencies.persistence.stock.findLevels({ companyId, ingredientIds: [ingredient.id] })
  if (!row) throw new Error('stock: nível sumiu')
  return toLevelView(row, ingredient)
}

function negative(text: string): Rational {
  const value = parseDecimal(text)
  return { numerator: -value.numerator, denominator: value.denominator }
}

export class ReceiveBatchUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  execute(params: ActorParams & { readonly input: ReceiveBatchData }): Promise<StockLevelView> {
    const { input } = params
    return recordSingleChange({
      dependencies: this.dependencies,
      actor: params,
      change: {
        ingredientId: input.ingredientId,
        delta: parseDecimal(input.quantity),
        unit: input.unit,
        kind: MOVEMENT_KIND.IN,
        reason: input.reason || `Entrada do lote ${input.batchCode}`,
        batch: {
          mode: 'new',
          batchCode: input.batchCode,
          costPerUnit: input.costPerUnit ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      },
    })
  }
}

/** Ajuste manual: aumento sem lote; diminuição consome dos lotes que vencem antes. */
export class AdjustStockUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  execute(params: ActorParams & { readonly input: AdjustStockData }): Promise<StockLevelView> {
    const { input } = params
    const isIncrease = input.direction === ADJUST_DIRECTION.INCREASE
    return recordSingleChange({
      dependencies: this.dependencies,
      actor: params,
      change: {
        ingredientId: input.ingredientId,
        delta: isIncrease ? parseDecimal(input.quantity) : negative(input.quantity),
        unit: input.unit,
        kind: MOVEMENT_KIND.ADJUST,
        reason: input.reason,
        batch: isIncrease ? { mode: 'none' } : { mode: 'fefo' },
      },
    })
  }
}

export class RecordLossUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  execute(params: ActorParams & { readonly input: RecordLossData }): Promise<StockLevelView> {
    const { input } = params
    return recordSingleChange({
      dependencies: this.dependencies,
      actor: params,
      change: {
        ingredientId: input.ingredientId,
        delta: negative(input.quantity),
        unit: input.unit,
        kind: MOVEMENT_KIND.LOSS,
        reason: input.reason,
        batch: input.batchId ? { mode: 'specific', batchId: input.batchId } : { mode: 'fefo' },
      },
    })
  }
}

export class ListMovementsUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly query: ListMovementsQuery
  }): Promise<Paginated<StockMovement>> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const page = await this.dependencies.persistence.stock.listMovements({
      ...params.query,
      companyId: params.companyId,
    })
    return toPaginated({ ...page, page: params.query.page, pageSize: params.query.pageSize, map: toMovement })
  }
}

export class ListBatchesUseCase {
  constructor(private readonly dependencies: StockDependencies) {}

  async execute(params: {
    readonly companyId: string
    readonly query: ListBatchesQuery
  }): Promise<Paginated<StockBatch>> {
    await assertStockEnabled(this.dependencies, params.companyId)
    const days = params.query.expiringWithinDays
    const expiresBefore =
      days === undefined ? undefined : new Date(this.dependencies.clock.now().getTime() + days * DAY_MS)
    const page = await this.dependencies.persistence.stock.listBatches({
      ...params.query,
      companyId: params.companyId,
      ...(expiresBefore ? { expiresBefore } : {}),
    })
    return toPaginated({ ...page, page: params.query.page, pageSize: params.query.pageSize, map: toBatch })
  }
}
