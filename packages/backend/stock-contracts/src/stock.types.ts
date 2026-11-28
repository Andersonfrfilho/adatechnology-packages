/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Quantidade em texto decimal de 4 casas, sempre na unidade atual do insumo (o módulo converte se
 * a unidade do insumo mudou entre g e kg depois do lançamento).
 */

import type { RecipeUnit } from '@adatechnology/recipe-contracts'

export const MOVEMENT_KIND = { IN: 'in', OUT: 'out', ADJUST: 'adjust', LOSS: 'loss' } as const
export type MovementKind = (typeof MOVEMENT_KIND)[keyof typeof MOVEMENT_KIND]
export const MOVEMENT_KINDS = Object.values(MOVEMENT_KIND) as readonly MovementKind[]

export const INVENTORY_STATUS = { OPEN: 'open', APPLIED: 'applied', CANCELLED: 'cancelled' } as const
export type InventoryStatus = (typeof INVENTORY_STATUS)[keyof typeof INVENTORY_STATUS]

export type StockLevelView = {
  readonly ingredientId: string
  readonly ingredientName: string | null
  readonly unit: RecipeUnit
  /** Pode ser negativo: venda sem entrada registrada não trava o pedido, aparece como furo. */
  readonly quantity: string
  readonly minimumQuantity: string | null
  readonly isBelowMinimum: boolean
  readonly updatedAt: string
}

export type StockBatch = {
  readonly id: string
  readonly ingredientId: string
  readonly batchCode: string
  readonly unit: RecipeUnit
  readonly quantity: string
  readonly remainingQuantity: string
  readonly costPerUnit: string | null
  /** `null`: insumo sem validade. */
  readonly expiresAt: string | null
  readonly receivedAt: string
}

export type StockMovement = {
  readonly id: string
  readonly ingredientId: string
  readonly batchId: string | null
  readonly kind: MovementKind
  /** Com sinal: entrada positiva, saída negativa. */
  readonly delta: string
  readonly unit: RecipeUnit
  readonly reason: string
  readonly actorId: string | null
  /** Chave de origem (ex.: `order:<id>:<linha>`) — a mesma chave nunca baixa duas vezes. */
  readonly sourceKey: string | null
  readonly createdAt: string
}

export type InventoryCountLine = {
  readonly ingredientId: string
  readonly ingredientName: string | null
  readonly unit: RecipeUnit
  readonly expectedQuantity: string
  readonly countedQuantity: string | null
}

export type InventoryCount = {
  readonly id: string
  readonly status: InventoryStatus
  readonly note: string
  readonly actorId: string | null
  readonly createdAt: string
  readonly appliedAt: string | null
  readonly lines: readonly InventoryCountLine[]
}

export type InventoryCountSummary = Omit<InventoryCount, 'lines'> & {
  readonly lineCount: number
  readonly countedCount: number
}

export const DEDUCTION_STATUS = {
  APPLIED: 'applied',
  ALREADY_APPLIED: 'already_applied',
  DISABLED: 'disabled',
} as const
export type DeductionStatus = (typeof DEDUCTION_STATUS)[keyof typeof DEDUCTION_STATUS]

export type OrderLineDeduction = {
  readonly lineKey: string
  readonly status: DeductionStatus
  readonly movementCount: number
}

export type OrderDeductionResult = {
  readonly orderId: string
  readonly lines: readonly OrderLineDeduction[]
  /** Produtos sem ficha: vendidos sem baixa (o painel pode avisar). */
  readonly productsWithoutRecipe: readonly string[]
}

export type ExpiringBatch = StockBatch & { readonly companyId: string; readonly ingredientName: string | null }
