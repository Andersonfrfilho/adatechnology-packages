/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O ciclo de uma ocorrência: `open → paid` (baixa), `paid → open` (desfazer baixa), `open → canceled`. Paga não se
 * cancela (desfaça a baixa antes) e cancelada não volta.
 */
import type { ExpenseOccurrenceStatus } from './types'

export type ExpenseOccurrenceAction = 'settle' | 'reopen' | 'cancel'

const ALLOWED: Readonly<Record<ExpenseOccurrenceAction, ExpenseOccurrenceStatus>> = {
  cancel: 'open',
  reopen: 'paid',
  settle: 'open',
}

export function canTransitionOccurrence(status: ExpenseOccurrenceStatus, action: ExpenseOccurrenceAction): boolean {
  return ALLOWED[action] === status
}
