/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { civilDateInTimeZone } from '@adatechnology/expense-contracts'

import type { ExpenseDatabase } from './database.types'
import { createExpenseService, type ExpenseClock, type ExpenseService } from './use-cases/expenseService'

export type CreateExpenseModuleParams = {
  readonly db: ExpenseDatabase
  /** Relógio injetável (teste, fuso do produto). Padrão: o dia civil de agora em `timeZone`. */
  readonly clock?: ExpenseClock
  /** Fuso do dia civil (vencimento, "hoje"). Padrão `America/Sao_Paulo`. */
  readonly timeZone?: string
}

export type ExpenseModule = {
  readonly clock: ExpenseClock
  readonly expenses: ExpenseService
}

export function createExpenseModule(params: CreateExpenseModuleParams): ExpenseModule {
  const timeZone = params.timeZone ?? 'America/Sao_Paulo'
  const clock: ExpenseClock = params.clock ?? { today: () => civilDateInTimeZone(new Date(), timeZone) }
  return { clock, expenses: createExpenseService({ clock, db: params.db }) }
}
