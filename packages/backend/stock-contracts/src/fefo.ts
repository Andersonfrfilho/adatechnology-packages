/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Primeiro que vence, primeiro que sai (FEFO). Puro: o módulo aplica o plano dentro da transação
 * com os lotes travados.
 */

import { compare, formatDecimal, parseDecimal, subtract, ZERO, type Rational } from '@adatechnology/recipe-contracts'

export type FefoBatch = {
  readonly id: string
  readonly remainingQuantity: string
  readonly expiresAt: string | null
  readonly receivedAt: string
}

export type FefoAllocation = { readonly batchId: string; readonly quantity: string; readonly remainingAfter: string }

export type FefoPlan = {
  readonly allocations: readonly FefoAllocation[]
  /** O que não coube em lote nenhum (saída sem lote, o nível fica negativo). */
  readonly uncovered: string
}

function byExpiry(left: FefoBatch, right: FefoBatch): number {
  // Sem validade vai por último; empate pela entrada mais antiga.
  if (left.expiresAt !== right.expiresAt) {
    if (left.expiresAt === null) return 1
    if (right.expiresAt === null) return -1
    return left.expiresAt < right.expiresAt ? -1 : 1
  }
  return left.receivedAt < right.receivedAt ? -1 : left.receivedAt > right.receivedAt ? 1 : 0
}

export function planFefoConsumption(params: {
  readonly batches: readonly FefoBatch[]
  readonly quantity: Rational
}): FefoPlan {
  let remaining = params.quantity
  const allocations: FefoAllocation[] = []
  for (const batch of [...params.batches].sort(byExpiry)) {
    if (compare(remaining, ZERO) <= 0) break
    const available = parseDecimal(batch.remainingQuantity)
    if (compare(available, ZERO) <= 0) continue
    const taken = compare(available, remaining) <= 0 ? available : remaining
    remaining = subtract(remaining, taken)
    allocations.push({
      batchId: batch.id,
      quantity: formatDecimal(taken),
      remainingAfter: formatDecimal(subtract(available, taken)),
    })
  }
  return { allocations, uncovered: formatDecimal(compare(remaining, ZERO) > 0 ? remaining : ZERO) }
}
