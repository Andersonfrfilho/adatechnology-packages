/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O resumo de um período a partir das ocorrências: quanto está previsto, pago, em aberto e vencido, e por categoria.
 * Puro: serve ao painel, ao relatório e a quem só tem a lista (o servidor MCP lê a lista e resume aqui).
 */
import { civilDaysBetween } from './reminder'
import { formatCents, parseStoredMoneyToCents } from './money'
import type { ExpenseDueState, ExpenseOccurrenceStatus } from './types'

export type SummarizableOccurrence = {
  readonly categoryId?: string
  readonly categoryName?: string
  readonly dueDate: string
  readonly expectedAmount: string
  readonly paidAmount: string | null
  readonly status: ExpenseOccurrenceStatus
}

export type ExpenseCategoryTotal = {
  readonly categoryId: string
  readonly categoryName: string
  readonly expected: string
  readonly open: string
  readonly paid: string
}

export type ExpensePeriodSummary = {
  readonly count: { readonly open: number; readonly overdue: number; readonly paid: number; readonly canceled: number }
  /** Previsto das abertas + pago das pagas (o "custo do período"). Cancelada não entra. */
  readonly total: string
  readonly open: string
  readonly overdue: string
  readonly paid: string
  readonly byCategory: readonly ExpenseCategoryTotal[]
}

/** A situação de uma ocorrência aberta em relação a `today`. */
export function dueStateOf(dueDate: string, today: string): ExpenseDueState {
  const days = civilDaysBetween(today, dueDate)
  if (days > 0) return 'upcoming'
  return days === 0 ? 'due_today' : 'overdue'
}

function cents(value: string | null): bigint {
  return value === null ? 0n : (parseStoredMoneyToCents(value) ?? 0n)
}

export function summarizeExpenseOccurrences(
  occurrences: readonly SummarizableOccurrence[],
  today: string,
): ExpensePeriodSummary {
  let open = 0n
  let overdue = 0n
  let paid = 0n
  const count = { canceled: 0, open: 0, overdue: 0, paid: 0 }
  const categories = new Map<string, { name: string; expected: bigint; open: bigint; paid: bigint }>()

  for (const occurrence of occurrences) {
    if (occurrence.status === 'canceled') {
      count.canceled += 1
      continue
    }
    const key = occurrence.categoryId ?? 'sem-categoria'
    const bucket = categories.get(key) ?? {
      expected: 0n,
      name: occurrence.categoryName ?? 'Sem categoria',
      open: 0n,
      paid: 0n,
    }
    if (occurrence.status === 'paid') {
      const value = cents(occurrence.paidAmount ?? occurrence.expectedAmount)
      paid += value
      bucket.paid += value
      bucket.expected += value
      count.paid += 1
    } else {
      const value = cents(occurrence.expectedAmount)
      open += value
      bucket.open += value
      bucket.expected += value
      count.open += 1
      if (dueStateOf(occurrence.dueDate, today) === 'overdue') {
        overdue += value
        count.overdue += 1
      }
    }
    categories.set(key, bucket)
  }

  return {
    byCategory: [...categories.entries()]
      .map(([categoryId, bucket]) => ({
        categoryId,
        categoryName: bucket.name,
        expected: formatCents(bucket.expected),
        open: formatCents(bucket.open),
        paid: formatCents(bucket.paid),
      }))
      .sort((left, right) => {
        const diff = parseStoredMoneyToCents(right.expected)! - parseStoredMoneyToCents(left.expected)!
        return diff > 0n ? 1 : diff < 0n ? -1 : left.categoryName.localeCompare(right.categoryName, 'pt-BR')
      }),
    count,
    open: formatCents(open),
    overdue: formatCents(overdue),
    paid: formatCents(paid),
    total: formatCents(open + paid),
  }
}
