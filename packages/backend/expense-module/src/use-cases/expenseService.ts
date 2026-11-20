/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Os casos de uso do módulo de contas. Toda regra de calendário, valor e resumo vem de
 * `@adatechnology/expense-contracts`; aqui só há leitura, escrita e a ordem em que acontecem.
 *
 * Multiempresa: todo método recebe `companyId` (do contexto autenticado do host, nunca do corpo) e toda consulta
 * filtra por ele. Registro de outra empresa responde como inexistente.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm'

import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_REMINDER_SETTINGS,
  EXPENSE_GENERATION_WINDOW_MONTHS,
  ExpenseError,
  amountInEffect,
  canTransitionOccurrence,
  competenceOfDate,
  isCivilDate,
  isCompetence,
  normalizeMoney,
  parseExpenseAmount,
  planAmountChange,
  planFixedExpenseOccurrences,
  reminderKindOn,
  summarizeExpenseOccurrences,
  type Expense,
  type ExpenseAmountChange,
  type ExpenseAmountChangeKind,
  type ExpenseCategory,
  type ExpenseChannel,
  type ExpenseCostGroup,
  type ExpenseKind,
  type ExpenseOccurrence,
  type ExpenseOccurrenceListItem,
  type ExpenseOccurrenceStatus,
  type ExpensePeriodSummary,
  type ExpenseRecurrence,
  type ReminderKind,
  type ReminderSettings,
} from '@adatechnology/expense-contracts'

import type { ExpenseDatabase } from '../database.types'
import {
  expenseAmountChanges,
  expenseCategories,
  expenseOccurrences,
  expenseReminderDeliveries,
  expenses,
  type ExpenseAmountChangeRow,
  type ExpenseCategoryRow,
  type ExpenseOccurrenceRow,
  type ExpenseRow,
} from '../schema/schema'

export type ExpenseClock = {
  /** Dia civil de hoje (`yyyy-mm-dd`) no fuso do produto. */
  today(): string
}

export type CreateExpenseInput = {
  readonly anchorCompetence?: string
  readonly assetRef?: string | null
  readonly billUrl?: string | null
  readonly categoryId: string
  /** Vencimento da conta variável (`yyyy-mm-dd`). */
  readonly dueDate?: string
  /** Dia do vencimento da fixa (1–31), menos na quinzenal. */
  readonly dueDay?: number | null
  readonly expectedAmount: string
  readonly installmentsTotal?: number | null
  readonly kind: ExpenseKind
  readonly name: string
  readonly notes?: string | null
  readonly payeeName?: string | null
  readonly payeeRef?: string | null
  readonly recurrence?: ExpenseRecurrence | null
  readonly responsibleUserId?: string | null
  readonly supplier?: string | null
}

export type UpdateExpenseInput = {
  readonly active?: boolean
  readonly assetRef?: string | null
  readonly billUrl?: string | null
  readonly categoryId?: string
  readonly name?: string
  readonly notes?: string | null
  readonly payeeName?: string | null
  readonly payeeRef?: string | null
  readonly responsibleUserId?: string | null
  readonly supplier?: string | null
}

export type ListOccurrencesInput = {
  readonly categoryId?: string
  readonly expenseId?: string
  readonly from?: string
  readonly kind?: ExpenseKind
  readonly limit?: number
  readonly search?: string
  readonly status?: readonly ExpenseOccurrenceStatus[]
  readonly to?: string
}

export type ReminderCandidate = {
  readonly kind: ReminderKind
  readonly occurrence: ExpenseOccurrenceListItem
  readonly responsibleUserId: string | null
}

const DEFAULT_LIST_LIMIT = 500
const MAX_LIST_LIMIT = 2000

function iso(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toCategory(row: ExpenseCategoryRow): ExpenseCategory {
  return {
    active: row.active,
    costGroup: row.costGroup as ExpenseCostGroup,
    displayOrder: row.displayOrder,
    id: row.id,
    name: row.name,
  }
}

function toExpense(row: ExpenseRow): Expense {
  return {
    active: row.active,
    anchorCompetence: row.anchorCompetence,
    assetRef: row.assetRef,
    billUrl: row.billUrl,
    categoryId: row.categoryId,
    companyId: row.companyId,
    createdAt: iso(row.createdAt) ?? '',
    dueDay: row.dueDay,
    expectedAmount: row.expectedAmount,
    id: row.id,
    installmentsTotal: row.installmentsTotal,
    kind: row.kind as ExpenseKind,
    name: row.name,
    notes: row.notes,
    payeeName: row.payeeName,
    payeeRef: row.payeeRef,
    recurrence: row.recurrence as ExpenseRecurrence | null,
    responsibleUserId: row.responsibleUserId,
    supplier: row.supplier,
  }
}

function toOccurrence(row: ExpenseOccurrenceRow): ExpenseOccurrence {
  return {
    canceledAt: iso(row.canceledAt),
    cancelReason: row.cancelReason,
    companyId: row.companyId,
    competence: row.competence,
    dueDate: row.dueDate,
    expectedAmount: row.expectedAmount,
    expenseId: row.expenseId,
    id: row.id,
    installmentNumber: row.installmentNumber,
    paidAmount: row.paidAmount,
    paidAt: row.paidAt,
    paidBy: row.paidBy,
    settledVia: row.settledVia as ExpenseChannel | null,
    settlementNote: row.settlementNote,
    slot: row.slot === 2 ? 2 : 1,
    status: row.status as ExpenseOccurrenceStatus,
  }
}

function toAmountChange(row: ExpenseAmountChangeRow): ExpenseAmountChange {
  return {
    changedBy: row.changedBy,
    createdAt: iso(row.createdAt) ?? '',
    effectiveCompetence: row.effectiveCompetence,
    expenseId: row.expenseId,
    id: row.id,
    kind: row.kind as ExpenseAmountChangeKind,
    newAmount: row.newAmount,
    previousAmount: row.previousAmount,
  }
}

/** Aceita `1500.50` (API) e a forma digitada `R$ 1.500,50`. */
function requireMoney(value: string): string {
  const normalized = normalizeMoney(value) ?? parseExpenseAmount(value) ?? null
  if (normalized === null || normalized === '0.00' || normalized.startsWith('-')) {
    throw new ExpenseError('AMOUNT_INVALID')
  }
  return normalized
}

function cleanText(value: string | null | undefined, max: number): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed.slice(0, max)
}

function requireName(value: string): string {
  const name = value.trim().replace(/\s+/gu, ' ')
  if (name.length < 2 || name.length > 120)
    throw new ExpenseError('INVALID_SCHEDULE', 'O nome precisa ter de 2 a 120 letras.')
  return name
}

/** Escreve só as chaves presentes (ausente = não mexe; `null` = limpa). */
function presentOnly<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>
}

export function createExpenseService(params: { readonly db: ExpenseDatabase; readonly clock: ExpenseClock }) {
  const { db, clock } = params

  async function findCategory(companyId: string, id: string): Promise<ExpenseCategoryRow> {
    const [row] = await db
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.companyId, companyId), eq(expenseCategories.id, id)))
      .limit(1)
    if (!row) throw new ExpenseError('CATEGORY_NOT_FOUND')
    return row
  }

  async function findExpenseRow(companyId: string, id: string): Promise<ExpenseRow> {
    const [row] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, id)))
      .limit(1)
    if (!row) throw new ExpenseError('EXPENSE_NOT_FOUND')
    return row
  }

  async function findOccurrenceRow(companyId: string, id: string): Promise<ExpenseOccurrenceRow> {
    const [row] = await db
      .select()
      .from(expenseOccurrences)
      .where(and(eq(expenseOccurrences.companyId, companyId), eq(expenseOccurrences.id, id)))
      .limit(1)
    if (!row) throw new ExpenseError('OCCURRENCE_NOT_FOUND')
    return row
  }

  async function listChanges(companyId: string, expenseId: string): Promise<ExpenseAmountChangeRow[]> {
    return db
      .select()
      .from(expenseAmountChanges)
      .where(and(eq(expenseAmountChanges.companyId, companyId), eq(expenseAmountChanges.expenseId, expenseId)))
      .orderBy(asc(expenseAmountChanges.effectiveCompetence), asc(expenseAmountChanges.createdAt))
  }

  /** Grava as ocorrências que a conta fixa pede na janela; o `unique` de `(expense, competence, slot)` torna idempotente. */
  async function generateFor(row: ExpenseRow, today: string): Promise<number> {
    if (row.kind !== 'fixed' || !row.active || row.recurrence === null) return 0
    const changes = await listChanges(row.companyId, row.id)
    const planned = planFixedExpenseOccurrences({
      anchorCompetence: row.anchorCompetence,
      dueDay: row.dueDay,
      installmentsTotal: row.installmentsTotal,
      recurrence: row.recurrence as ExpenseRecurrence,
      today,
      windowMonths: EXPENSE_GENERATION_WINDOW_MONTHS,
    })
    if (planned.length === 0) return 0
    const created = await db
      .insert(expenseOccurrences)
      .values(
        planned.map((item) => ({
          companyId: row.companyId,
          competence: item.competence,
          dueDate: item.dueDate,
          expectedAmount: amountInEffect(
            row.expectedAmount,
            changes.map((change) => ({ ...change, createdAt: iso(change.createdAt) ?? '' })),
            item.competence,
          ),
          expenseId: row.id,
          installmentNumber: item.installmentNumber,
          slot: item.slot,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: expenseOccurrences.id })
    return created.length
  }

  function occurrenceListQuery() {
    return db
      .select({
        occurrence: expenseOccurrences,
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        expenseKind: expenses.kind,
        expenseName: expenses.name,
        installmentsTotal: expenses.installmentsTotal,
        payeeName: expenses.payeeName,
        responsibleUserId: expenses.responsibleUserId,
        supplier: expenses.supplier,
      })
      .from(expenseOccurrences)
      .innerJoin(expenses, eq(expenses.id, expenseOccurrences.expenseId))
      .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
  }

  type OccurrenceJoinRow = Awaited<ReturnType<ReturnType<typeof occurrenceListQuery>['execute']>>[number]

  function toListItem(row: OccurrenceJoinRow): ExpenseOccurrenceListItem {
    return {
      ...toOccurrence(row.occurrence),
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      expenseKind: row.expenseKind as ExpenseKind,
      expenseName: row.expenseName,
      installmentsTotal: row.installmentsTotal,
      payeeName: row.payeeName,
      supplier: row.supplier,
    }
  }

  function occurrenceFilters(companyId: string, input: ListOccurrencesInput): SQL[] {
    const filters: SQL[] = [eq(expenseOccurrences.companyId, companyId)]
    if (input.from !== undefined) filters.push(gte(expenseOccurrences.dueDate, input.from))
    if (input.to !== undefined) filters.push(lte(expenseOccurrences.dueDate, input.to))
    if (input.status !== undefined && input.status.length > 0) {
      filters.push(inArray(expenseOccurrences.status, [...input.status]))
    }
    if (input.expenseId !== undefined) filters.push(eq(expenseOccurrences.expenseId, input.expenseId))
    if (input.categoryId !== undefined) filters.push(eq(expenses.categoryId, input.categoryId))
    if (input.kind !== undefined) filters.push(eq(expenses.kind, input.kind))
    if (input.search !== undefined && input.search.trim() !== '') {
      const pattern = `%${input.search.trim().replace(/[\\%_]/gu, (match) => `\\${match}`)}%`
      const match = or(
        ilike(expenses.name, pattern),
        ilike(expenses.supplier, pattern),
        ilike(expenses.payeeName, pattern),
      )
      if (match) filters.push(match)
    }
    return filters
  }

  async function readListItem(companyId: string, id: string): Promise<ExpenseOccurrenceListItem> {
    const [row] = await occurrenceListQuery()
      .where(and(eq(expenseOccurrences.companyId, companyId), eq(expenseOccurrences.id, id)))
      .limit(1)
    if (!row) throw new ExpenseError('OCCURRENCE_NOT_FOUND')
    return toListItem(row)
  }

  return {
    /** Lista as categorias; empresa sem nenhuma recebe as padrão na primeira leitura. */
    async listCategories(input: { readonly companyId: string; readonly includeInactive?: boolean }) {
      await this.ensureDefaultCategories({ companyId: input.companyId })
      const filters: SQL[] = [eq(expenseCategories.companyId, input.companyId)]
      if (!input.includeInactive) filters.push(eq(expenseCategories.active, true))
      const rows = await db
        .select()
        .from(expenseCategories)
        .where(and(...filters))
        .orderBy(asc(expenseCategories.displayOrder), asc(expenseCategories.name))
      return rows.map(toCategory)
    },

    /** Semeia `DEFAULT_EXPENSE_CATEGORIES` só para quem nunca teve categoria (renomear ou desligar nunca é desfeito). */
    async ensureDefaultCategories(input: { readonly companyId: string }): Promise<number> {
      const [existing] = await db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(eq(expenseCategories.companyId, input.companyId))
        .limit(1)
      if (existing) return 0
      const created = await db
        .insert(expenseCategories)
        .values(
          DEFAULT_EXPENSE_CATEGORIES.map((category, index) => ({
            companyId: input.companyId,
            costGroup: category.costGroup,
            displayOrder: (index + 1) * 10,
            name: category.name,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: expenseCategories.id })
      return created.length
    },

    async createCategory(input: {
      readonly companyId: string
      readonly costGroup?: ExpenseCostGroup
      readonly displayOrder?: number
      readonly name: string
    }): Promise<ExpenseCategory> {
      const name = requireName(input.name).slice(0, 80)
      const [row] = await db
        .insert(expenseCategories)
        .values({
          companyId: input.companyId,
          costGroup: input.costGroup ?? 'administrative',
          displayOrder: input.displayOrder ?? 1000,
          name,
        })
        .onConflictDoNothing()
        .returning()
      if (!row) throw new ExpenseError('CATEGORY_NAME_TAKEN')
      return toCategory(row)
    },

    async updateCategory(input: {
      readonly active?: boolean
      readonly companyId: string
      readonly costGroup?: ExpenseCostGroup
      readonly displayOrder?: number
      readonly id: string
      readonly name?: string
    }): Promise<ExpenseCategory> {
      await findCategory(input.companyId, input.id)
      const values = presentOnly({
        active: input.active,
        costGroup: input.costGroup,
        displayOrder: input.displayOrder,
        name: input.name === undefined ? undefined : requireName(input.name).slice(0, 80),
      })
      try {
        const [row] = await db
          .update(expenseCategories)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(expenseCategories.companyId, input.companyId), eq(expenseCategories.id, input.id)))
          .returning()
        if (!row) throw new ExpenseError('CATEGORY_NOT_FOUND')
        return toCategory(row)
      } catch (error) {
        if (isUniqueViolation(error)) throw new ExpenseError('CATEGORY_NAME_TAKEN')
        throw error
      }
    },

    /** Lança a conta. A fixa gera os vencimentos da janela; a variável nasce com o seu único vencimento. */
    async createExpense(input: {
      readonly companyId: string
      readonly createdBy?: string | null
      readonly createdVia?: ExpenseChannel
      readonly expense: CreateExpenseInput
    }): Promise<{ readonly expense: Expense; readonly occurrencesCreated: number }> {
      const today = clock.today()
      const data = input.expense
      const category = await findCategory(input.companyId, data.categoryId)
      if (!category.active) throw new ExpenseError('CATEGORY_INACTIVE')
      const amount = requireMoney(data.expectedAmount)
      const name = requireName(data.name)

      let recurrence: ExpenseRecurrence | null = null
      let dueDay: number | null = null
      let anchorCompetence: string
      if (data.kind === 'fixed') {
        recurrence = data.recurrence ?? 'monthly'
        if (recurrence !== 'fortnightly') {
          dueDay = data.dueDay ?? null
          if (dueDay === null || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
            throw new ExpenseError('INVALID_SCHEDULE', 'O dia do vencimento vai de 1 a 31.')
          }
        }
        anchorCompetence = data.anchorCompetence ?? competenceOfDate(today)
        if (!isCompetence(anchorCompetence))
          throw new ExpenseError('INVALID_SCHEDULE', 'O mês de início precisa ser yyyy-mm.')
        if (
          data.installmentsTotal !== undefined &&
          data.installmentsTotal !== null &&
          (!Number.isInteger(data.installmentsTotal) || data.installmentsTotal < 1)
        ) {
          throw new ExpenseError('INVALID_SCHEDULE', 'O número de parcelas precisa ser inteiro e positivo.')
        }
      } else {
        if (data.dueDate === undefined || !isCivilDate(data.dueDate)) {
          throw new ExpenseError('INVALID_SCHEDULE', 'A conta avulsa precisa da data do vencimento (yyyy-mm-dd).')
        }
        anchorCompetence = competenceOfDate(data.dueDate)
      }

      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(expenses)
          .values({
            anchorCompetence,
            assetRef: cleanText(data.assetRef, 200),
            billUrl: cleanText(data.billUrl, 2000),
            categoryId: category.id,
            companyId: input.companyId,
            createdBy: input.createdBy ?? null,
            createdVia: input.createdVia ?? 'panel',
            dueDay,
            expectedAmount: amount,
            installmentsTotal: data.kind === 'fixed' ? (data.installmentsTotal ?? null) : null,
            kind: data.kind,
            name,
            notes: cleanText(data.notes, 2000),
            payeeName: cleanText(data.payeeName, 120),
            payeeRef: cleanText(data.payeeRef, 200),
            recurrence,
            responsibleUserId: cleanText(data.responsibleUserId, 200),
            supplier: cleanText(data.supplier, 120),
          })
          .returning()
        if (!row) throw new Error('expense insert returned no row')

        let occurrencesCreated = 0
        if (row.kind === 'variable' && data.dueDate !== undefined) {
          await tx.insert(expenseOccurrences).values({
            companyId: row.companyId,
            competence: anchorCompetence,
            dueDate: data.dueDate,
            expectedAmount: amount,
            expenseId: row.id,
          })
          occurrencesCreated = 1
        } else {
          occurrencesCreated = await createExpenseService({ clock, db: tx as unknown as ExpenseDatabase }).generateFor(
            row,
          )
        }
        return { expense: toExpense(row), occurrencesCreated }
      })
    },

    /** Uso interno e da rotina: gera os vencimentos da conta fixa na janela que começa hoje. */
    async generateFor(row: ExpenseRow): Promise<number> {
      return generateFor(row, clock.today())
    },

    /** Para a rotina diária do host: completa a janela de todas as contas fixas ativas (de uma empresa ou de todas). */
    async generateOccurrences(input: { readonly companyId?: string } = {}): Promise<{ readonly created: number }> {
      const today = clock.today()
      const filters: SQL[] = [eq(expenses.active, true), eq(expenses.kind, 'fixed')]
      if (input.companyId !== undefined) filters.push(eq(expenses.companyId, input.companyId))
      const rows = await db
        .select()
        .from(expenses)
        .where(and(...filters))
      let created = 0
      for (const row of rows) created += await generateFor(row, today)
      return { created }
    },

    async getExpense(input: { readonly companyId: string; readonly id: string }) {
      const row = await findExpenseRow(input.companyId, input.id)
      const changes = await listChanges(input.companyId, input.id)
      const today = clock.today()
      return {
        ...toExpense(row),
        currentAmount: amountInEffect(
          row.expectedAmount,
          changes.map((change) => ({ ...change, createdAt: iso(change.createdAt) ?? '' })),
          competenceOfDate(today),
        ),
      }
    },

    async listExpenses(input: {
      readonly active?: boolean
      readonly categoryId?: string
      readonly companyId: string
      readonly kind?: ExpenseKind
      readonly search?: string
    }): Promise<Expense[]> {
      const filters: SQL[] = [eq(expenses.companyId, input.companyId)]
      if (input.active !== undefined) filters.push(eq(expenses.active, input.active))
      if (input.kind !== undefined) filters.push(eq(expenses.kind, input.kind))
      if (input.categoryId !== undefined) filters.push(eq(expenses.categoryId, input.categoryId))
      if (input.search !== undefined && input.search.trim() !== '') {
        filters.push(ilike(expenses.name, `%${input.search.trim().replace(/[\\%_]/gu, (match) => `\\${match}`)}%`))
      }
      const rows = await db
        .select()
        .from(expenses)
        .where(and(...filters))
        .orderBy(asc(expenses.name))
      return rows.map(toExpense)
    },

    /**
     * Edita os dados da conta. Desligar (`active: false`) cancela os vencimentos abertos de hoje em diante (os
     * vencidos continuam abertos: a dívida existe) e para de gerar novos.
     */
    async updateExpense(input: {
      readonly companyId: string
      readonly id: string
      readonly patch: UpdateExpenseInput
      readonly updatedBy?: string | null
    }): Promise<Expense> {
      const current = await findExpenseRow(input.companyId, input.id)
      const patch = input.patch
      if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) {
        const category = await findCategory(input.companyId, patch.categoryId)
        if (!category.active) throw new ExpenseError('CATEGORY_INACTIVE')
      }
      const values = presentOnly({
        active: patch.active,
        assetRef: patch.assetRef === undefined ? undefined : cleanText(patch.assetRef, 200),
        billUrl: patch.billUrl === undefined ? undefined : cleanText(patch.billUrl, 2000),
        categoryId: patch.categoryId,
        name: patch.name === undefined ? undefined : requireName(patch.name),
        notes: patch.notes === undefined ? undefined : cleanText(patch.notes, 2000),
        payeeName: patch.payeeName === undefined ? undefined : cleanText(patch.payeeName, 120),
        payeeRef: patch.payeeRef === undefined ? undefined : cleanText(patch.payeeRef, 200),
        responsibleUserId: patch.responsibleUserId === undefined ? undefined : cleanText(patch.responsibleUserId, 200),
        supplier: patch.supplier === undefined ? undefined : cleanText(patch.supplier, 120),
      })
      const today = clock.today()
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(expenses)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(expenses.companyId, input.companyId), eq(expenses.id, input.id)))
          .returning()
        if (!row) throw new ExpenseError('EXPENSE_NOT_FOUND')
        if (current.active && row.active === false) {
          await tx
            .update(expenseOccurrences)
            .set({
              cancelReason: 'expense_deactivated',
              canceledAt: new Date(),
              status: 'canceled',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(expenseOccurrences.companyId, input.companyId),
                eq(expenseOccurrences.expenseId, input.id),
                eq(expenseOccurrences.status, 'open'),
                gte(expenseOccurrences.dueDate, today),
              ),
            )
        }
        if (!current.active && row.active) {
          await createExpenseService({ clock, db: tx as unknown as ExpenseDatabase }).generateFor(row)
        }
        return toExpense(row)
      })
    },

    /**
     * Muda o valor da conta com histórico. Reajuste vale de `effectiveFrom` (padrão: este mês) e só regrava o que
     * ainda não venceu; correção troca o trecho inteiro da competência informada. Pago e cancelado nunca mudam.
     */
    async changeAmount(input: {
      readonly changedBy: string
      readonly companyId: string
      readonly correctionCompetence?: string
      readonly effectiveFrom?: string
      readonly id: string
      readonly kind?: ExpenseAmountChangeKind
      readonly newAmount: string
    }): Promise<{ readonly change: ExpenseAmountChange | null; readonly occurrencesUpdated: number }> {
      const row = await findExpenseRow(input.companyId, input.id)
      const newAmount = requireMoney(input.newAmount)
      const today = clock.today()
      const changes = await listChanges(input.companyId, input.id)
      let plan
      try {
        plan = planAmountChange({
          baseAmount: row.expectedAmount,
          changes: changes.map((change) => ({ ...change, createdAt: iso(change.createdAt) ?? '' })),
          newAmount,
          today,
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
          ...(input.correctionCompetence !== undefined ? { correctionCompetence: input.correctionCompetence } : {}),
        })
      } catch {
        throw new ExpenseError('INVALID_SCHEDULE', 'Período da mudança de valor inválido.')
      }
      if (plan === null) return { change: null, occurrencesUpdated: 0 }
      const decided = plan

      return db.transaction(async (tx) => {
        const [change] = await tx
          .insert(expenseAmountChanges)
          .values({
            changedBy: input.changedBy,
            companyId: input.companyId,
            effectiveCompetence: decided.effectiveCompetence,
            expenseId: row.id,
            kind: decided.kind,
            newAmount: decided.newAmount,
            previousAmount: decided.previousAmount,
            untilCompetence: decided.untilCompetence,
          })
          .returning()
        if (!change) throw new Error('amount change insert returned no row')
        const filters: SQL[] = [
          eq(expenseOccurrences.companyId, input.companyId),
          eq(expenseOccurrences.expenseId, row.id),
          eq(expenseOccurrences.status, 'open'),
          gte(expenseOccurrences.competence, decided.effectiveCompetence),
        ]
        if (decided.untilCompetence !== null) {
          filters.push(sql`${expenseOccurrences.competence} < ${decided.untilCompetence}`)
        }
        if (decided.onlyNotDue) filters.push(gte(expenseOccurrences.dueDate, today))
        const updated = await tx
          .update(expenseOccurrences)
          .set({ expectedAmount: decided.newAmount, updatedAt: new Date() })
          .where(and(...filters))
          .returning({ id: expenseOccurrences.id })
        return { change: toAmountChange(change), occurrencesUpdated: updated.length }
      })
    },

    async listAmountHistory(input: { readonly companyId: string; readonly id: string }) {
      await findExpenseRow(input.companyId, input.id)
      const rows = await db
        .select()
        .from(expenseAmountChanges)
        .where(and(eq(expenseAmountChanges.companyId, input.companyId), eq(expenseAmountChanges.expenseId, input.id)))
        .orderBy(desc(expenseAmountChanges.createdAt))
      return rows.map(toAmountChange)
    },

    async listOccurrences(input: { readonly companyId: string } & ListOccurrencesInput) {
      const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
      const rows = await occurrenceListQuery()
        .where(and(...occurrenceFilters(input.companyId, input)))
        .orderBy(asc(expenseOccurrences.dueDate), asc(expenses.name), asc(expenseOccurrences.id))
        .limit(limit)
      return rows.map(toListItem)
    },

    getOccurrence(input: { readonly companyId: string; readonly id: string }) {
      return readListItem(input.companyId, input.id)
    },

    /** Resumo do período (previsto, pago, aberto, vencido e por categoria), pela regra única do contracts. */
    async summarize(input: { readonly companyId: string } & ListOccurrencesInput): Promise<ExpensePeriodSummary> {
      const rows = await occurrenceListQuery()
        .where(and(...occurrenceFilters(input.companyId, { ...input, status: undefined } as ListOccurrencesInput)))
        .orderBy(asc(expenseOccurrences.dueDate))
      return summarizeExpenseOccurrences(rows.map(toListItem), clock.today())
    },

    /** Dá baixa: valor pago (padrão: o previsto) e data (padrão: hoje). Pagar de novo o que já está pago é recusado. */
    async settleOccurrence(input: {
      readonly companyId: string
      readonly id: string
      readonly paidAmount?: string
      readonly paidAt?: string
      readonly paidBy?: string | null
      readonly settlementNote?: string | null
      readonly via?: ExpenseChannel
    }): Promise<ExpenseOccurrenceListItem> {
      const row = await findOccurrenceRow(input.companyId, input.id)
      if (!canTransitionOccurrence(row.status as ExpenseOccurrenceStatus, 'settle')) {
        throw new ExpenseError('OCCURRENCE_TRANSITION_NOT_ALLOWED')
      }
      const paidAt = input.paidAt ?? clock.today()
      if (!isCivilDate(paidAt))
        throw new ExpenseError('INVALID_SCHEDULE', 'A data do pagamento precisa ser yyyy-mm-dd.')
      const paidAmount = input.paidAmount === undefined ? row.expectedAmount : requireMoney(input.paidAmount)
      const updated = await db
        .update(expenseOccurrences)
        .set({
          paidAmount,
          paidAt,
          paidBy: input.paidBy ?? null,
          settledVia: input.via ?? 'panel',
          settlementNote: cleanText(input.settlementNote, 2000),
          status: 'paid',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseOccurrences.companyId, input.companyId),
            eq(expenseOccurrences.id, input.id),
            eq(expenseOccurrences.status, 'open'),
          ),
        )
        .returning({ id: expenseOccurrences.id })
      if (updated.length === 0) throw new ExpenseError('OCCURRENCE_TRANSITION_NOT_ALLOWED')
      return readListItem(input.companyId, input.id)
    },

    /** Desfaz a baixa (pagamento lançado por engano). */
    async reopenOccurrence(input: { readonly companyId: string; readonly id: string }) {
      const row = await findOccurrenceRow(input.companyId, input.id)
      if (!canTransitionOccurrence(row.status as ExpenseOccurrenceStatus, 'reopen')) {
        throw new ExpenseError('OCCURRENCE_TRANSITION_NOT_ALLOWED')
      }
      await db
        .update(expenseOccurrences)
        .set({
          paidAmount: null,
          paidAt: null,
          paidBy: null,
          settledVia: null,
          settlementNote: null,
          status: 'open',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseOccurrences.companyId, input.companyId),
            eq(expenseOccurrences.id, input.id),
            eq(expenseOccurrences.status, 'paid'),
          ),
        )
      return readListItem(input.companyId, input.id)
    },

    /** Cancela um vencimento (não será pago). Só o aberto; o pago reabre antes. */
    async cancelOccurrence(input: {
      readonly companyId: string
      readonly id: string
      readonly reason?: string | null
    }) {
      const row = await findOccurrenceRow(input.companyId, input.id)
      if (!canTransitionOccurrence(row.status as ExpenseOccurrenceStatus, 'cancel')) {
        throw new ExpenseError('OCCURRENCE_TRANSITION_NOT_ALLOWED')
      }
      await db
        .update(expenseOccurrences)
        .set({
          cancelReason: cleanText(input.reason, 500),
          canceledAt: new Date(),
          status: 'canceled',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(expenseOccurrences.companyId, input.companyId),
            eq(expenseOccurrences.id, input.id),
            eq(expenseOccurrences.status, 'open'),
          ),
        )
      return readListItem(input.companyId, input.id)
    },

    /**
     * Para a rotina de avisos do host: as ocorrências abertas que pedem aviso hoje (antes, no dia ou em atraso),
     * com quem é o responsável. Quem recebe e por qual canal é decisão do host (`chooseReminderRecipients`).
     */
    async listReminderCandidates(
      input: {
        readonly companyId?: string
        readonly settings?: ReminderSettings
      } = {},
    ): Promise<ReminderCandidate[]> {
      const settings = input.settings ?? DEFAULT_REMINDER_SETTINGS
      const today = clock.today()
      const windowStart = shiftDate(today, -Math.max(settings.maxOverdueNotices, 0))
      const windowEnd = shiftDate(today, Math.max(settings.daysBefore, 0))
      const filters: SQL[] = [
        eq(expenseOccurrences.status, 'open'),
        gte(expenseOccurrences.dueDate, windowStart),
        lte(expenseOccurrences.dueDate, windowEnd),
        eq(expenses.active, true),
      ]
      if (input.companyId !== undefined) filters.push(eq(expenseOccurrences.companyId, input.companyId))
      const rows = await occurrenceListQuery()
        .where(and(...filters))
        .orderBy(asc(expenseOccurrences.companyId), asc(expenseOccurrences.dueDate))
      const candidates: ReminderCandidate[] = []
      for (const row of rows) {
        const kind = reminderKindOn({ dueDate: row.occurrence.dueDate, settings, today })
        if (kind !== null) {
          candidates.push({ kind, occurrence: toListItem(row), responsibleUserId: row.responsibleUserId })
        }
      }
      return candidates
    },

    /**
     * Marca o aviso como enviado. Devolve `false` quando ele já tinha saído hoje (para a mesma pessoa e canal): o
     * host só envia quando recebe `true`, então duas réplicas da rotina nunca mandam duas vezes.
     */
    async claimReminderDelivery(input: {
      readonly channel: string
      readonly companyId: string
      readonly kind: ReminderKind
      readonly occurrenceId: string
      readonly recipientRef: string
    }): Promise<boolean> {
      await findOccurrenceRow(input.companyId, input.occurrenceId)
      const inserted = await db
        .insert(expenseReminderDeliveries)
        .values({
          channel: input.channel,
          companyId: input.companyId,
          kind: input.kind,
          occurrenceId: input.occurrenceId,
          recipientRef: input.recipientRef,
          reminderDate: clock.today(),
        })
        .onConflictDoNothing()
        .returning({ id: expenseReminderDeliveries.id })
      return inserted.length > 0
    },
  }
}

export type ExpenseService = ReturnType<typeof createExpenseService>

function shiftDate(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth += 1) {
    const record = current as { code?: unknown; errno?: unknown; cause?: unknown }
    if (record.code === '23505' || record.errno === '23505') return true
    current = record.cause
  }
  return false
}
