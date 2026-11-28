/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O único caminho que muda saldo: dentro da transação, com o nível já travado. Entrada cria lote
 * (ou não); saída consome lote certo ou FEFO, e o que não couber em lote sai sem lote (nível
 * negativo, visível). Tudo na unidade gravada no nível.
 */

import {
  add,
  compare,
  convertQuantity,
  formatDecimal,
  parseDecimal,
  ZERO,
  type Rational,
  type RecipeUnit,
} from '@adatechnology/recipe-contracts'
import {
  InsufficientBatchError,
  planFefoConsumption,
  StockBatchNotFoundError,
  StockIncompatibleUnitError,
  type MovementKind,
} from '@adatechnology/stock-contracts'

import type { LevelRow, NewMovementRow } from '../schema/schema'
import type { StockTransaction } from '../use-cases/stockModule.types'

export type BatchMode =
  | { readonly mode: 'none' }
  | { readonly mode: 'fefo' }
  | { readonly mode: 'specific'; readonly batchId: string }
  | {
      readonly mode: 'new'
      readonly batchCode: string
      readonly costPerUnit: string | null
      readonly expiresAt: Date | null
    }

export type LedgerChange = {
  readonly companyId: string
  readonly ingredientId: string
  /** Na unidade de `unit` (a do pedido ou do insumo); convertida para a do nível. */
  readonly delta: Rational
  readonly unit: RecipeUnit
  readonly kind: MovementKind
  readonly reason: string
  readonly actorId: string | null
  readonly sourceKey: string | null
  readonly batch: BatchMode
  readonly now: Date
}

export type LedgerResult = {
  readonly ingredientId: string
  readonly before: string
  readonly after: string
  readonly minimumQuantity: string | null
  readonly movementCount: number
}

export function toLevelUnit(params: {
  readonly quantity: Rational
  readonly from: RecipeUnit
  readonly level: LevelRow
}): Rational {
  const levelUnit = params.level.unit as RecipeUnit
  const converted = convertQuantity({ quantity: params.quantity, from: params.from, to: levelUnit })
  if (!converted) throw new StockIncompatibleUnitError({ unit: params.from, ingredientUnit: levelUnit })
  return converted
}

function negate(value: Rational): Rational {
  return { numerator: -value.numerator, denominator: value.denominator }
}

async function decreaseMovements(params: {
  readonly transaction: StockTransaction
  readonly change: LedgerChange
  readonly amount: Rational
  readonly base: Omit<NewMovementRow, 'delta' | 'batchId'>
}): Promise<NewMovementRow[]> {
  const { transaction, change, amount, base } = params
  if (change.batch.mode === 'specific') {
    const batch = await transaction.lockBatch({ companyId: change.companyId, id: change.batch.batchId })
    if (!batch || batch.ingredientId !== change.ingredientId) throw new StockBatchNotFoundError(change.batch.batchId)
    const remaining = parseDecimal(batch.remainingQuantity)
    if (compare(remaining, amount) < 0)
      throw new InsufficientBatchError({ batchId: batch.id, remainingQuantity: formatDecimal(remaining) })
    await transaction.setBatchRemaining({
      id: batch.id,
      remainingQuantity: formatDecimal(add(remaining, negate(amount))),
    })
    return [{ ...base, batchId: batch.id, delta: formatDecimal(negate(amount)) }]
  }
  if (change.batch.mode !== 'fefo') return [{ ...base, batchId: null, delta: formatDecimal(negate(amount)) }]

  const batches = await transaction.lockBatches({ companyId: change.companyId, ingredientId: change.ingredientId })
  const plan = planFefoConsumption({
    batches: batches.map((batch) => ({
      id: batch.id,
      remainingQuantity: batch.remainingQuantity,
      expiresAt: batch.expiresAt?.toISOString() ?? null,
      receivedAt: batch.receivedAt.toISOString(),
    })),
    quantity: amount,
  })
  await Promise.all(
    plan.allocations.map((allocation) =>
      transaction.setBatchRemaining({ id: allocation.batchId, remainingQuantity: allocation.remainingAfter }),
    ),
  )
  const rows: NewMovementRow[] = plan.allocations.map((allocation) => ({
    ...base,
    batchId: allocation.batchId,
    delta: `-${allocation.quantity}`,
  }))
  if (compare(parseDecimal(plan.uncovered), ZERO) > 0)
    rows.push({ ...base, batchId: null, delta: `-${plan.uncovered}` })
  return rows
}

export async function applyLedgerChange(params: {
  readonly transaction: StockTransaction
  readonly level: LevelRow
  readonly change: LedgerChange
}): Promise<LedgerResult> {
  const { transaction, level, change } = params
  const amountSigned = toLevelUnit({ quantity: change.delta, from: change.unit, level })
  const isIncrease = compare(amountSigned, ZERO) > 0
  const base = {
    companyId: change.companyId,
    ingredientId: change.ingredientId,
    kind: change.kind,
    unit: level.unit,
    reason: change.reason,
    actorId: change.actorId,
    sourceKey: change.sourceKey,
    createdAt: change.now,
  }

  let rows: NewMovementRow[]
  if (isIncrease && change.batch.mode === 'new') {
    const quantity = formatDecimal(amountSigned)
    const batch = await transaction.insertBatch({
      companyId: change.companyId,
      ingredientId: change.ingredientId,
      batchCode: change.batch.batchCode,
      unit: level.unit,
      quantity,
      remainingQuantity: quantity,
      costPerUnit: change.batch.costPerUnit,
      expiresAt: change.batch.expiresAt,
      receivedAt: change.now,
    })
    rows = [{ ...base, batchId: batch.id, delta: quantity }]
  } else if (isIncrease) {
    rows = [{ ...base, batchId: null, delta: formatDecimal(amountSigned) }]
  } else {
    rows = await decreaseMovements({ transaction, change, amount: negate(amountSigned), base })
  }

  await transaction.insertMovements(rows)
  const after = add(parseDecimal(level.quantity), amountSigned)
  await transaction.setLevelQuantity({
    companyId: change.companyId,
    ingredientId: change.ingredientId,
    quantity: formatDecimal(after),
    now: change.now,
  })
  return {
    ingredientId: change.ingredientId,
    before: level.quantity,
    after: formatDecimal(after),
    minimumQuantity: level.minimumQuantity,
    movementCount: rows.length,
  }
}

/** Cruzou o mínimo para baixo nesta mudança (avisa uma vez por cruzamento). */
export function crossedBelowMinimum(result: LedgerResult): boolean {
  if (result.minimumQuantity === null) return false
  const minimum = parseDecimal(result.minimumQuantity)
  return compare(parseDecimal(result.before), minimum) >= 0 && compare(parseDecimal(result.after), minimum) < 0
}
