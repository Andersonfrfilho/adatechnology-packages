/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo contra Postgres de verdade (migrations, unique, CHECKs, transação). Roda só com DATABASE_URL
 * (ou DRIZZLE_TEST_DATABASE_URL); a CI do SDK sobe o Postgres e define a variável.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

import { createExpenseModule, runExpenseMigrations, type ExpenseModule } from './index'

const url = process.env['DRIZZLE_TEST_DATABASE_URL'] ?? process.env['DATABASE_URL']

describe.skipIf(url === undefined)('expense-module contra Postgres', () => {
  let pool: Pool
  let module: ExpenseModule
  let today = '2026-11-20'
  const companyId = `test-${randomUUID()}`
  const otherCompanyId = `test-${randomUUID()}`

  beforeAll(async () => {
    pool = new Pool({ connectionString: url })
    const db = drizzle(pool)
    await runExpenseMigrations({ db, migrate: migrate as never })
    await runExpenseMigrations({ db, migrate: migrate as never })
    module = createExpenseModule({ clock: { today: () => today }, db })
  })

  afterAll(async () => {
    await pool.query(`delete from expense.expenses where company_id in ($1, $2)`, [companyId, otherCompanyId])
    await pool.query(`delete from expense.categories where company_id in ($1, $2)`, [companyId, otherCompanyId])
    await pool.end()
  })

  it('semeia as categorias padrão uma vez só, e por empresa', async () => {
    const first = await module.expenses.listCategories({ companyId })
    expect(first.map((category) => category.name)).toContain('Aluguel')
    expect(await module.expenses.ensureDefaultCategories({ companyId })).toBe(0)
    const other = await module.expenses.listCategories({ companyId: otherCompanyId })
    expect(other.map((category) => category.id)).not.toContain(first[0]?.id)
  })

  it('nome de categoria repetido (sem diferenciar caixa) é recusado', async () => {
    await expect(module.expenses.createCategory({ companyId, name: 'aluguel' })).rejects.toMatchObject({
      code: 'EXPENSE_CATEGORY_NAME_TAKEN',
    })
  })

  it('conta fixa gera os vencimentos da janela, e gerar de novo não duplica', async () => {
    const [category] = await module.expenses.listCategories({ companyId })
    const created = await module.expenses.createExpense({
      companyId,
      expense: {
        categoryId: category!.id,
        dueDay: 10,
        expectedAmount: '3.500,00',
        kind: 'fixed',
        name: 'Aluguel do salão',
        recurrence: 'monthly',
      },
    })
    expect(created.occurrencesCreated).toBe(4)
    expect(created.expense.expectedAmount).toBe('3500.00')
    expect((await module.expenses.generateOccurrences({ companyId })).created).toBe(0)

    const occurrences = await module.expenses.listOccurrences({ companyId, expenseId: created.expense.id })
    expect(occurrences.map((item) => item.dueDate)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10'])
    expect(occurrences[0]).toMatchObject({
      categoryName: category!.name,
      expenseName: 'Aluguel do salão',
      status: 'open',
    })
  })

  it('reajuste só regrava o que não venceu; o histórico guarda o anterior', async () => {
    const [expense] = await module.expenses.listExpenses({ companyId, search: 'salão' })
    const result = await module.expenses.changeAmount({
      changedBy: 'u1',
      companyId,
      id: expense!.id,
      newAmount: '3800',
    })
    expect(result.change).toMatchObject({
      effectiveCompetence: '2026-11',
      newAmount: '3800.00',
      previousAmount: '3500.00',
    })
    expect(result.occurrencesUpdated).toBe(3)
    const amounts = (await module.expenses.listOccurrences({ companyId, expenseId: expense!.id })).map(
      (item) => item.expectedAmount,
    )
    expect(amounts).toEqual(['3500.00', '3800.00', '3800.00', '3800.00'])
    expect(await module.expenses.listAmountHistory({ companyId, id: expense!.id })).toHaveLength(1)
    expect((await module.expenses.getExpense({ companyId, id: expense!.id })).currentAmount).toBe('3800.00')
  })

  it('baixa, desfaz, cancela; pagar duas vezes é recusado', async () => {
    const [occurrence] = await module.expenses.listOccurrences({ companyId, status: ['open'], to: '2026-11-30' })
    const paid = await module.expenses.settleOccurrence({
      companyId,
      id: occurrence!.id,
      paidAmount: '3490,90',
      via: 'whatsapp',
    })
    expect(paid).toMatchObject({ paidAmount: '3490.90', paidAt: today, settledVia: 'whatsapp', status: 'paid' })
    await expect(module.expenses.settleOccurrence({ companyId, id: occurrence!.id })).rejects.toMatchObject({
      code: 'EXPENSE_OCCURRENCE_TRANSITION_NOT_ALLOWED',
    })
    expect((await module.expenses.reopenOccurrence({ companyId, id: occurrence!.id })).status).toBe('open')
    expect(
      (await module.expenses.cancelOccurrence({ companyId, id: occurrence!.id, reason: 'renegociado' })).status,
    ).toBe('canceled')
  })

  it('outra empresa não enxerga nem mexe', async () => {
    const [occurrence] = await module.expenses.listOccurrences({ companyId })
    expect(await module.expenses.listOccurrences({ companyId: otherCompanyId })).toEqual([])
    await expect(
      module.expenses.settleOccurrence({ companyId: otherCompanyId, id: occurrence!.id }),
    ).rejects.toMatchObject({
      code: 'EXPENSE_OCCURRENCE_NOT_FOUND',
    })
  })

  it('conta variável nasce com um vencimento; o resumo soma o período', async () => {
    const categories = await module.expenses.listCategories({ companyId })
    const energy = categories.find((category) => category.name === 'Energia')!
    await module.expenses.createExpense({
      companyId,
      createdVia: 'whatsapp',
      expense: {
        categoryId: energy.id,
        dueDate: '2026-11-25',
        expectedAmount: '450',
        kind: 'variable',
        name: 'Conta de luz',
      },
    })
    const summary = await module.expenses.summarize({ companyId, from: '2026-11-01', to: '2026-11-30' })
    expect(summary).toMatchObject({ count: { canceled: 1, open: 1, overdue: 0 }, open: '450.00', total: '450.00' })
  })

  it('aviso: candidatos do dia e a marca de enviado vale uma vez', async () => {
    today = '2026-11-22'
    const candidates = await module.expenses.listReminderCandidates({ companyId })
    const light = candidates.find((candidate) => candidate.occurrence.expenseName === 'Conta de luz')
    expect(light?.kind).toBe('before')
    const claim = {
      channel: 'email',
      companyId,
      kind: light!.kind,
      occurrenceId: light!.occurrence.id,
      recipientRef: 'u1',
    }
    expect(await module.expenses.claimReminderDelivery(claim)).toBe(true)
    expect(await module.expenses.claimReminderDelivery(claim)).toBe(false)
    today = '2026-11-20'
  })

  it('desligar a conta cancela os vencimentos de hoje em diante', async () => {
    const [expense] = await module.expenses.listExpenses({ companyId, search: 'salão' })
    await module.expenses.updateExpense({ companyId, id: expense!.id, patch: { active: false } })
    const open = await module.expenses.listOccurrences({ companyId, expenseId: expense!.id, status: ['open'] })
    expect(open).toEqual([])
  })
})
