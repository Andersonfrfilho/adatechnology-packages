/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rateio das contas do período entre as unidades de trabalho concluídas (viagem, pedido, atendimento). Função pura.
 * Dinheiro entra e sai em texto com duas casas; a conta fecha em centavos (piso + resto à unidade de maior peso, com as
 * unidades em ordem estável por conclusão e id).
 *
 * Três garantias:
 * - para cada conta, Σ partes + não rateado = valor considerado, centavo a centavo;
 * - o grupo `in_unit` só entra pelo excedente sobre as unidades incluídas no pagamento (o custo já mora na unidade);
 * - trocar o critério muda a divisão, nunca o total.
 */
import { distributeByWeight, formatCents, parseStoredMoneyToCents } from './money'
import type { ExpenseCostGroup } from './types'

/** O grupo `in_unit` não é rateado: o custo já está na unidade. */
export type AllocatableCostGroup = Exclude<ExpenseCostGroup, 'in_unit'>
export const ALLOCATABLE_COST_GROUPS: readonly AllocatableCostGroup[] = [
  'asset_fixed',
  'per_distance',
  'administrative',
]

export const ALLOCATION_CRITERIA = ['per_distance', 'per_unit_day', 'per_revenue', 'equal'] as const
export type AllocationCriterion = (typeof ALLOCATION_CRITERIA)[number]
export type AllocationSettings = Readonly<Record<AllocatableCostGroup, AllocationCriterion>>

/** Padrão sem configuração: fixo do bem e variável por distância, administrativo pelo faturamento. */
export const DEFAULT_ALLOCATION_SETTINGS: AllocationSettings = {
  administrative: 'per_revenue',
  asset_fixed: 'per_distance',
  per_distance: 'per_distance',
}

/** Unidade de trabalho concluída no período, com o resultado vivo. */
export type AllocationUnit = {
  /** `yyyy-mm-dd` da conclusão. */
  readonly completedOn: string
  /** Bem que executou a unidade (veículo, máquina, sala); nulo quando não há. */
  readonly assetId: string | null
  readonly daysCount: number
  readonly distanceMeters: number
  /** Receita da unidade; aceita até quatro casas (`numeric(19,4)`). */
  readonly revenue: string
  readonly unitId: string
}

/** Conta do período com o valor já considerado (pago, senão previsto); cancelada nunca chega aqui. */
export type AllocationExpense = {
  readonly amount: string
  /** Bem ligado à conta: ela só se divide entre as unidades dele. */
  readonly assetId: string | null
  readonly costGroup: ExpenseCostGroup
  readonly expenseId: string
  /** Só no grupo `in_unit`: soma das unidades incluídas no pagamento. */
  readonly includedUnitsAmount?: string
  readonly occurrenceId: string
}

export type AllocationShare = {
  readonly amount: string
  readonly occurrenceId: string
  /** `asset`: conta ligada a um bem; `general`: conta sem bem e o excedente do pagamento. */
  readonly scope: 'asset' | 'general'
  readonly unitId: string
}

export type UnallocatedReason = 'asset_without_units' | 'no_unit_weight'

export type AllocationUnallocated = {
  readonly amount: string
  readonly assetId: string | null
  readonly occurrenceId: string
  readonly reason: UnallocatedReason
}

export type AllocationResult = {
  /** Pagamento que passou das unidades incluídas (bônus, adiantamento), rateado como administrativo. */
  readonly excesses: readonly { readonly amount: string; readonly occurrenceId: string }[]
  readonly shares: readonly AllocationShare[]
  readonly unallocated: readonly AllocationUnallocated[]
}

export function allocateExpenses(input: {
  readonly expenses: readonly AllocationExpense[]
  readonly settings: AllocationSettings
  readonly units: readonly AllocationUnit[]
}): AllocationResult {
  const units = [...input.units].sort(compareUnits)
  const excesses: { amount: string; occurrenceId: string }[] = []
  const shares: AllocationShare[] = []
  const unallocated: AllocationUnallocated[] = []

  for (const expense of input.expenses) {
    const considered = requireCents(expense.amount, `amount of ${expense.occurrenceId}`)
    let amount = considered
    let group: AllocatableCostGroup
    let assetId = expense.assetId

    if (expense.costGroup === 'in_unit') {
      const included = requireCents(
        expense.includedUnitsAmount ?? '0',
        `includedUnitsAmount of ${expense.occurrenceId}`,
      )
      amount = considered > included ? considered - included : 0n
      if (amount === 0n) continue
      excesses.push({ amount: formatCents(amount), occurrenceId: expense.occurrenceId })
      group = 'administrative'
      assetId = null
    } else {
      group = expense.costGroup
    }

    if (amount === 0n) continue

    const eligible = assetId === null ? units : units.filter((unit) => unit.assetId === assetId)
    if (assetId !== null && eligible.length === 0) {
      unallocated.push({
        amount: formatCents(amount),
        assetId,
        occurrenceId: expense.occurrenceId,
        reason: 'asset_without_units',
      })
      continue
    }

    const criterion = input.settings[group]
    const weights = eligible.map((unit) => weightOf(unit, criterion))
    if (weights.every((weight) => weight === 0n)) {
      unallocated.push({
        amount: formatCents(amount),
        assetId,
        occurrenceId: expense.occurrenceId,
        reason: 'no_unit_weight',
      })
      continue
    }

    const scope = assetId === null ? 'general' : 'asset'
    distributeByWeight(amount, weights).forEach((part, index) => {
      const unit = eligible[index]
      if (part === 0n || unit === undefined) return
      shares.push({ amount: formatCents(part), occurrenceId: expense.occurrenceId, scope, unitId: unit.unitId })
    })
  }

  return { excesses, shares, unallocated }
}

function compareUnits(left: AllocationUnit, right: AllocationUnit): number {
  if (left.completedOn !== right.completedOn) return left.completedOn < right.completedOn ? -1 : 1
  if (left.unitId === right.unitId) return 0
  return left.unitId < right.unitId ? -1 : 1
}

/** Peso da unidade pelo critério. Sem o dado (zero, negativo ou ilegível), peso zero: as outras absorvem. */
function weightOf(unit: AllocationUnit, criterion: AllocationCriterion): bigint {
  switch (criterion) {
    case 'equal':
      return 1n
    case 'per_distance':
      return positiveWhole(unit.distanceMeters)
    case 'per_unit_day':
      return positiveWhole(unit.daysCount)
    case 'per_revenue':
      return revenueWeight(unit.revenue)
  }
}

function positiveWhole(value: number): bigint {
  return Number.isFinite(value) && value > 0 ? BigInt(Math.round(value)) : 0n
}

/** A receita é só peso: aceita as quatro casas do banco sem arredondar. Negativa ou ilegível pesa zero. */
function revenueWeight(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value.trim())
  if (match?.[1] === undefined) return 0n
  return BigInt(match[1]) * 10_000n + BigInt((match[2] ?? '').padEnd(4, '0'))
}

function requireCents(value: string, label: string): bigint {
  const cents = parseStoredMoneyToCents(value)
  if (cents === null) throw new Error(`expense allocation: invalid money in ${label}`)
  return cents
}
