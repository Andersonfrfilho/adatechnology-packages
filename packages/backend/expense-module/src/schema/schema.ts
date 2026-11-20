/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Tabelas do módulo de contas, todas no schema `expense` (nunca colide com tabela do host).
 *
 * - `company_id` é texto opaco: o host decide se é uuid de empresa, de restaurante ou de filial. Toda consulta filtra
 *   por ele.
 * - Dinheiro é `numeric(14,2)` (o driver devolve texto, nunca float).
 * - A ocorrência é o que vence: a conta fixa gera uma por competência (`(expense, competence, slot)` único, então
 *   gerar de novo nunca duplica); a variável nasce com uma só.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const expenseSchema = pgSchema('expense')

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const expenseCategories = expenseSchema.table(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: text('company_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    costGroup: varchar('cost_group', { length: 20 }).notNull().default('administrative'),
    displayOrder: integer('display_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('categories_company_name_unique').on(table.companyId, sql`lower(${table.name})`),
    check(
      'categories_cost_group_check',
      sql`${table.costGroup} in ('asset_fixed', 'per_distance', 'administrative', 'in_unit')`,
    ),
  ],
)

export const expenses = expenseSchema.table(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: text('company_id').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => expenseCategories.id),
    kind: varchar('kind', { length: 10 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    expectedAmount: numeric('expected_amount', { precision: 14, scale: 2 }).notNull(),
    recurrence: varchar('recurrence', { length: 12 }),
    dueDay: smallint('due_day'),
    anchorCompetence: varchar('anchor_competence', { length: 7 }).notNull(),
    installmentsTotal: integer('installments_total'),
    notes: text('notes'),
    supplier: varchar('supplier', { length: 120 }),
    billUrl: text('bill_url'),
    payeeRef: text('payee_ref'),
    payeeName: varchar('payee_name', { length: 120 }),
    assetRef: text('asset_ref'),
    responsibleUserId: text('responsible_user_id'),
    active: boolean('active').notNull().default(true),
    createdBy: text('created_by'),
    createdVia: varchar('created_via', { length: 10 }).notNull().default('panel'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('expenses_company_idx').on(table.companyId, table.active),
    check('expenses_kind_check', sql`${table.kind} in ('fixed', 'variable')`),
    check(
      'expenses_schedule_check',
      sql`(${table.kind} = 'variable' and ${table.recurrence} is null and ${table.dueDay} is null)
        or (${table.kind} = 'fixed' and ${table.recurrence} = 'fortnightly' and ${table.dueDay} is null)
        or (${table.kind} = 'fixed' and ${table.recurrence} in ('monthly', 'bimonthly', 'quarterly', 'yearly')
            and ${table.dueDay} between 1 and 31)`,
    ),
    check('expenses_amount_check', sql`${table.expectedAmount} > 0`),
    check('expenses_installments_check', sql`${table.installmentsTotal} is null or ${table.installmentsTotal} > 0`),
  ],
)

export const expenseOccurrences = expenseSchema.table(
  'occurrences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: text('company_id').notNull(),
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    competence: varchar('competence', { length: 7 }).notNull(),
    slot: smallint('slot').notNull().default(1),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    expectedAmount: numeric('expected_amount', { precision: 14, scale: 2 }).notNull(),
    installmentNumber: integer('installment_number'),
    status: varchar('status', { length: 10 }).notNull().default('open'),
    paidAmount: numeric('paid_amount', { precision: 14, scale: 2 }),
    paidAt: date('paid_at', { mode: 'string' }),
    paidBy: text('paid_by'),
    settledVia: varchar('settled_via', { length: 10 }),
    settlementNote: text('settlement_note'),
    cancelReason: text('cancel_reason'),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('occurrences_expense_competence_slot_unique').on(table.expenseId, table.competence, table.slot),
    index('occurrences_company_due_idx').on(table.companyId, table.dueDate),
    check('occurrences_status_check', sql`${table.status} in ('open', 'paid', 'canceled')`),
    check(
      'occurrences_paid_check',
      sql`(${table.status} = 'paid') = (${table.paidAmount} is not null and ${table.paidAt} is not null)`,
    ),
  ],
)

export const expenseAmountChanges = expenseSchema.table(
  'amount_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: text('company_id').notNull(),
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 12 }).notNull(),
    previousAmount: numeric('previous_amount', { precision: 14, scale: 2 }).notNull(),
    newAmount: numeric('new_amount', { precision: 14, scale: 2 }).notNull(),
    effectiveCompetence: varchar('effective_competence', { length: 7 }).notNull(),
    untilCompetence: varchar('until_competence', { length: 7 }),
    changedBy: text('changed_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('amount_changes_expense_idx').on(table.companyId, table.expenseId),
    check('amount_changes_kind_check', sql`${table.kind} in ('adjustment', 'correction')`),
  ],
)

/** Um aviso enviado: a linha única é o que impede o mesmo aviso de sair duas vezes no mesmo dia. */
export const expenseReminderDeliveries = expenseSchema.table(
  'reminder_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: text('company_id').notNull(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => expenseOccurrences.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 12 }).notNull(),
    reminderDate: date('reminder_date', { mode: 'string' }).notNull(),
    recipientRef: text('recipient_ref').notNull(),
    channel: varchar('channel', { length: 12 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('reminder_deliveries_unique').on(
      table.occurrenceId,
      table.kind,
      table.reminderDate,
      table.recipientRef,
      table.channel,
    ),
  ],
)

export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect
export type ExpenseRow = typeof expenses.$inferSelect
export type NewExpenseRow = typeof expenses.$inferInsert
export type ExpenseOccurrenceRow = typeof expenseOccurrences.$inferSelect
export type ExpenseAmountChangeRow = typeof expenseAmountChanges.$inferSelect
