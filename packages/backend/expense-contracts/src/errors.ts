/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Códigos estáveis de recusa do módulo de contas. O host traduz para HTTP (`status`) e a tela, para texto.
 */

export const EXPENSE_ERROR = {
  AMOUNT_INVALID: { code: 'EXPENSE_AMOUNT_INVALID', status: 400 },
  CATEGORY_INACTIVE: { code: 'EXPENSE_CATEGORY_INACTIVE', status: 409 },
  CATEGORY_NAME_TAKEN: { code: 'EXPENSE_CATEGORY_NAME_TAKEN', status: 409 },
  CATEGORY_NOT_FOUND: { code: 'EXPENSE_CATEGORY_NOT_FOUND', status: 404 },
  EXPENSE_NOT_FOUND: { code: 'EXPENSE_NOT_FOUND', status: 404 },
  INVALID_SCHEDULE: { code: 'EXPENSE_INVALID_SCHEDULE', status: 400 },
  OCCURRENCE_NOT_FOUND: { code: 'EXPENSE_OCCURRENCE_NOT_FOUND', status: 404 },
  OCCURRENCE_TRANSITION_NOT_ALLOWED: { code: 'EXPENSE_OCCURRENCE_TRANSITION_NOT_ALLOWED', status: 409 },
  UNAUTHENTICATED: { code: 'EXPENSE_UNAUTHENTICATED', status: 401 },
} as const

/** Texto padrão (pt-BR) de cada recusa; a tela pode trocar pelo dela usando o `code`. */
export const EXPENSE_ERROR_MESSAGES: Record<keyof typeof EXPENSE_ERROR, string> = {
  AMOUNT_INVALID: 'Valor inválido.',
  CATEGORY_INACTIVE: 'A categoria está desligada.',
  CATEGORY_NAME_TAKEN: 'Já existe uma categoria com esse nome.',
  CATEGORY_NOT_FOUND: 'Categoria não encontrada.',
  EXPENSE_NOT_FOUND: 'Conta não encontrada.',
  INVALID_SCHEDULE: 'Vencimento ou recorrência inválidos.',
  OCCURRENCE_NOT_FOUND: 'Vencimento não encontrado.',
  OCCURRENCE_TRANSITION_NOT_ALLOWED: 'Esse vencimento não permite essa ação no estado atual.',
  UNAUTHENTICATED: 'Identificação da empresa ausente.',
}

export type ExpenseErrorKey = keyof typeof EXPENSE_ERROR
export type ExpenseErrorCode = (typeof EXPENSE_ERROR)[ExpenseErrorKey]['code']

export class ExpenseError extends Error {
  readonly code: ExpenseErrorCode
  readonly status: number
  /** Mesmo valor de `status`, no nome que o `@adatechnology/module-http` reconhece como erro de domínio. */
  readonly statusCode: number

  constructor(key: ExpenseErrorKey, message?: string) {
    super(message ?? EXPENSE_ERROR_MESSAGES[key])
    this.name = 'ExpenseError'
    this.code = EXPENSE_ERROR[key].code
    this.status = EXPENSE_ERROR[key].status
    this.statusCode = EXPENSE_ERROR[key].status
  }
}

export function isExpenseError(error: unknown): error is ExpenseError {
  return error instanceof ExpenseError
}
