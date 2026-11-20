/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os filtros do resultado **não** mudam o rateio: ele é feito sobre todas as unidades e contas do período; o filtro só
 * escolhe quais linhas aparecem e somam.
 */

/** Unidade sem bem (ou sem cliente) não some do resultado: vira uma linha com este identificador. */
export const NO_ASSET_ID = 'sem-bem'
export const NO_CUSTOMER_ID = 'sem-cliente'

export type ExpenseResultFilters = {
  readonly assetId?: string
  readonly categoryId?: string
  readonly customerId?: string
  readonly payeeRef?: string
}

export const EXPENSE_RESULT_FILTER_KEYS = ['assetId', 'categoryId', 'customerId', 'payeeRef'] as const

export function hasResultFilters(filters: ExpenseResultFilters | undefined): boolean {
  return filters !== undefined && EXPENSE_RESULT_FILTER_KEYS.some((key) => filters[key] !== undefined)
}

export function unitMatchesFilters(
  unit: { readonly assetId: string; readonly customerId: string },
  filters: ExpenseResultFilters,
): boolean {
  if (filters.assetId !== undefined && unit.assetId !== filters.assetId) return false
  if (filters.customerId !== undefined && unit.customerId !== filters.customerId) return false
  return true
}

export function expenseMatchesFilters(
  expense: { readonly categoryId: string; readonly payeeRef: string | null | undefined },
  filters: ExpenseResultFilters,
): boolean {
  if (filters.categoryId !== undefined && expense.categoryId !== filters.categoryId) return false
  if (filters.payeeRef !== undefined && expense.payeeRef !== filters.payeeRef) return false
  return true
}
