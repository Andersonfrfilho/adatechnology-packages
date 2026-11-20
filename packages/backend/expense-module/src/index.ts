/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * @adatechnology/expense-module — contas a pagar com estado: categorias, contas fixas e variáveis, vencimentos,
 * baixa, histórico de valor, resumo do período e o que a rotina de avisos precisa. As regras puras moram em
 * `@adatechnology/expense-contracts` (reexportado aqui por conveniência).
 */
export * from '@adatechnology/expense-contracts'

export { createExpenseModule } from './ExpenseModule'
export type { CreateExpenseModuleParams, ExpenseModule } from './ExpenseModule'
export { createExpenseService } from './use-cases/expenseService'
export type {
  CreateExpenseInput,
  ExpenseClock,
  ExpenseService,
  ListOccurrencesInput,
  ReminderCandidate,
  UpdateExpenseInput,
} from './use-cases/expenseService'
export { createExpenseRoutes, EXPENSE_SCOPE } from './http/routes'
export type { CreateExpenseRoutesParams } from './http/routes'
export { runExpenseMigrations, expenseMigrationsFolder, EXPENSE_MIGRATIONS_TABLE } from './runMigrations'
export type { DrizzleMigrateFunction, ExpenseDatabase } from './database.types'
