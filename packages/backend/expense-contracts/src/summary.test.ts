/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { expect, it } from 'bun:test'

import { summarizeExpenseOccurrences } from './index'

it('resume previsto, pago, aberto e vencido; cancelada fica de fora', () => {
  const summary = summarizeExpenseOccurrences(
    [
      {
        categoryId: 'a',
        categoryName: 'Aluguel',
        dueDate: '2026-11-05',
        expectedAmount: '3000.00',
        paidAmount: '3000.00',
        status: 'paid',
      },
      {
        categoryId: 'e',
        categoryName: 'Energia',
        dueDate: '2026-11-10',
        expectedAmount: '450.00',
        paidAmount: null,
        status: 'open',
      },
      {
        categoryId: 'e',
        categoryName: 'Energia',
        dueDate: '2026-11-25',
        expectedAmount: '50.00',
        paidAmount: null,
        status: 'open',
      },
      {
        categoryId: 'a',
        categoryName: 'Aluguel',
        dueDate: '2026-11-01',
        expectedAmount: '99.00',
        paidAmount: null,
        status: 'canceled',
      },
    ],
    '2026-11-20',
  )
  expect(summary).toMatchObject({
    count: { canceled: 1, open: 2, overdue: 1, paid: 1 },
    open: '500.00',
    overdue: '450.00',
    paid: '3000.00',
    total: '3500.00',
  })
  expect(summary.byCategory.map((row) => row.categoryName)).toEqual(['Aluguel', 'Energia'])
})
