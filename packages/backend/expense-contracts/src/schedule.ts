/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vencimento é data civil, sem hora. A conta fixa gera uma janela de competências (mês corrente + 3); cada recorrência
 * cai em alguns meses e a quinzenal tem duas datas por mês (`slot` 1 = dia 15, `slot` 2 = último dia).
 */
import type { ExpenseRecurrence } from './types'

export const EXPENSE_GENERATION_WINDOW_MONTHS = 4
const FORTNIGHT_FIRST_DAY = 15
const MONTHS_BETWEEN: Readonly<Record<ExpenseRecurrence, number>> = {
  bimonthly: 2,
  fortnightly: 1,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

export type ResolveExpenseDueDateParams = {
  /** `yyyy-mm`. */
  readonly competence: string
  /** 1–31; mês curto cai no último dia. */
  readonly dueDay: number
}

export type ExpenseScheduleSlot = {
  readonly dueDate: string
  /** Número da parcela (1..total) só quando a conta é parcelada; nulo nas demais. */
  readonly installmentNumber: number | null
  readonly slot: 1 | 2
}

function parseCompetence(competence: string): { readonly month: number; readonly year: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(competence)
  if (match === null) throw new Error(`competence must be yyyy-mm: ${competence}`)
  return { month: Number(match[2]), year: Number(match[1]) }
}

function formatCompetence(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Índice contínuo do mês (`ano × 12 + mês − 1`), para contar distância entre competências. */
export function competenceIndex(competence: string): number {
  const { month, year } = parseCompetence(competence)
  return year * 12 + (month - 1)
}

/** Soma `months` meses a uma competência `yyyy-mm`. */
export function addCompetenceMonths(competence: string, months: number): string {
  const index = competenceIndex(competence) + months
  return formatCompetence(Math.floor(index / 12), (index % 12) + 1)
}

/** Devolve `yyyy-mm-dd`. */
export function resolveExpenseDueDate(params: ResolveExpenseDueDateParams): string {
  if (!Number.isInteger(params.dueDay) || params.dueDay < 1 || params.dueDay > 31) {
    throw new Error(`dueDay must be between 1 and 31: ${params.dueDay}`)
  }
  const { month, year } = parseCompetence(params.competence)
  const day = Math.min(params.dueDay, lastDayOfMonth(year, month))
  return `${params.competence}-${String(day).padStart(2, '0')}`
}

/** `yyyy-mm` de uma data civil `yyyy-mm-dd`. */
export function competenceOfDate(date: string): string {
  const match = /^(\d{4}-\d{2})-\d{2}$/.exec(date)
  if (match?.[1] === undefined) throw new Error(`date must be yyyy-mm-dd: ${date}`)
  parseCompetence(match[1])
  return match[1]
}

/** Primeiro e último dia (`yyyy-mm-dd`) de uma competência. */
export function competenceBounds(competence: string): { readonly from: string; readonly to: string } {
  const { month, year } = parseCompetence(competence)
  return {
    from: `${competence}-01`,
    to: `${competence}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`,
  }
}

/** As competências a gerar: a do `today` e as `months - 1` seguintes. */
export function listExpenseCompetenceWindow(
  today: string,
  months = EXPENSE_GENERATION_WINDOW_MONTHS,
): readonly string[] {
  const start = competenceIndex(competenceOfDate(today))
  return Array.from({ length: months }, (_, offset) => {
    const index = start + offset
    return formatCompetence(Math.floor(index / 12), (index % 12) + 1)
  })
}

/**
 * As datas que a recorrência pede numa competência (vazio quando o mês não é dela). `anchorCompetence` é o mês em
 * que a conta começou: bimestral/trimestral/anual contam a partir dele.
 */
export function resolveExpenseSlots(params: {
  readonly anchorCompetence: string
  readonly competence: string
  readonly dueDay: number | null
  /** Total de parcelas da conta; nulo = sem fim. A parcela além do total não é gerada. */
  readonly installmentsTotal?: number | null
  readonly recurrence: ExpenseRecurrence
}): readonly ExpenseScheduleSlot[] {
  const distance = competenceIndex(params.competence) - competenceIndex(params.anchorCompetence)
  const step = MONTHS_BETWEEN[params.recurrence]
  if (distance < 0 || distance % step !== 0) return []
  const total = params.installmentsTotal ?? null
  const perPeriod = params.recurrence === 'fortnightly' ? 2 : 1
  const base = (distance / step) * perPeriod
  const numberOf = (slot: 1 | 2): number | null => (total === null ? null : base + slot)
  const slots: ExpenseScheduleSlot[] = []
  if (params.recurrence === 'fortnightly') {
    slots.push(
      {
        dueDate: resolveExpenseDueDate({ competence: params.competence, dueDay: FORTNIGHT_FIRST_DAY }),
        installmentNumber: numberOf(1),
        slot: 1,
      },
      {
        dueDate: resolveExpenseDueDate({ competence: params.competence, dueDay: 31 }),
        installmentNumber: numberOf(2),
        slot: 2,
      },
    )
  } else {
    if (params.dueDay === null) throw new Error('dueDay is required for a non-fortnightly recurrence')
    slots.push({
      dueDate: resolveExpenseDueDate({ competence: params.competence, dueDay: params.dueDay }),
      installmentNumber: numberOf(1),
      slot: 1,
    })
  }
  return total === null ? slots : slots.filter((item) => (item.installmentNumber ?? 0) <= total)
}

/** Um vencimento a gerar: competência, slot, data e parcela. Chave natural `(competence, slot)`. */
export type PlannedExpenseOccurrence = ExpenseScheduleSlot & { readonly competence: string }

/**
 * Todas as ocorrências que uma conta fixa pede dentro da janela que começa em `today`. Idempotente por desenho:
 * quem grava usa `(expense, competence, slot)` como chave única e ignora o que já existe.
 */
export function planFixedExpenseOccurrences(params: {
  readonly anchorCompetence: string
  readonly dueDay: number | null
  readonly installmentsTotal?: number | null
  readonly recurrence: ExpenseRecurrence
  readonly today: string
  readonly windowMonths?: number
}): readonly PlannedExpenseOccurrence[] {
  return listExpenseCompetenceWindow(params.today, params.windowMonths).flatMap((competence) =>
    resolveExpenseSlots({
      anchorCompetence: params.anchorCompetence,
      competence,
      dueDay: params.dueDay,
      installmentsTotal: params.installmentsTotal ?? null,
      recurrence: params.recurrence,
    }).map((slot) => ({ ...slot, competence })),
  )
}
