/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Contrato da tabela de rotas sem banco: escopo, empresa vinda do token e recusa de entrada inválida.
 */
import { describe, expect, it } from 'bun:test'

import { compileRoutes, dispatchRoute, type AuthContext } from '@adatechnology/module-http'

import { createExpenseRoutes, EXPENSE_SCOPE } from './http/routes'
import type { ExpenseModule } from './ExpenseModule'

const calls: { method: string; input: unknown }[] = []
const fakeService = new Proxy(
  {},
  {
    get: (_target, method: string) => async (input: unknown) => {
      calls.push({ input, method })
      return { ok: true }
    },
  },
) as ExpenseModule['expenses']

const routes = compileRoutes(
  createExpenseRoutes({ module: { clock: { today: () => '2026-11-20' }, expenses: fakeService } }),
  '/v1',
)

async function dispatch(params: {
  auth?: AuthContext
  body?: unknown
  method: string
  path: string
  query?: Record<string, string>
}) {
  const result = await dispatchRoute({
    authResolver: { resolve: async () => params.auth },
    compiledRoutes: routes,
    request: {
      headers: { 'content-type': 'application/json' },
      method: params.method,
      pathname: params.path,
      query: params.query ?? {},
      ...(params.body === undefined ? {} : { rawBody: new TextEncoder().encode(JSON.stringify(params.body)) }),
    },
  })
  return result !== undefined && 'status' in result ? result : undefined
}

const reader: AuthContext = { companyId: 'empresa-a', scopes: [EXPENSE_SCOPE.READ], userId: 'u1' }
const writer: AuthContext = { companyId: 'empresa-a', scopes: [EXPENSE_SCOPE.READ, EXPENSE_SCOPE.WRITE], userId: 'u1' }

describe('rotas de contas', () => {
  it('sem identidade é 401; leitor não lança conta (403)', async () => {
    expect((await dispatch({ method: 'GET', path: '/v1/expenses' }))?.status).toBe(401)
    const result = await dispatch({
      auth: reader,
      body: {
        categoryId: crypto.randomUUID(),
        expectedAmount: '10',
        kind: 'variable',
        name: 'Gás',
        dueDate: '2026-11-30',
      },
      method: 'POST',
      path: '/v1/expenses',
    })
    expect(result?.status).toBe(403)
  })

  it('a empresa vem do token, nunca do corpo', async () => {
    calls.length = 0
    const result = await dispatch({
      auth: writer,
      body: {
        categoryId: crypto.randomUUID(),
        companyId: 'empresa-b',
        expectedAmount: '10',
        kind: 'variable',
        name: 'Gás',
      },
      method: 'POST',
      path: '/v1/expenses',
    })
    expect(result?.status).toBe(400)
    expect(calls).toHaveLength(0)

    await dispatch({
      auth: writer,
      body: {
        categoryId: crypto.randomUUID(),
        dueDate: '2026-11-30',
        expectedAmount: 10,
        kind: 'variable',
        name: 'Gás',
      },
      method: 'POST',
      path: '/v1/expenses',
    })
    expect(calls[0]).toMatchObject({
      input: { companyId: 'empresa-a', createdBy: 'u1', expense: { expectedAmount: '10' } },
      method: 'createExpense',
    })
  })

  it('id que não é uuid é 404 sem chegar ao serviço', async () => {
    calls.length = 0
    const result = await dispatch({ auth: reader, method: 'GET', path: '/v1/expenses/abc' })
    expect(result?.status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('status da lista é conferido', async () => {
    const bad = await dispatch({
      auth: reader,
      method: 'GET',
      path: '/v1/expense-occurrences',
      query: { status: 'open,late' },
    })
    expect(bad?.status).toBe(400)
    calls.length = 0
    await dispatch({
      auth: reader,
      method: 'GET',
      path: '/v1/expense-occurrences',
      query: { from: '2026-11-01', status: 'open,paid' },
    })
    expect(calls[0]?.input).toEqual({ companyId: 'empresa-a', from: '2026-11-01', status: ['open', 'paid'] })
  })
})

describe('formato compatível com a API da transportada', () => {
  it('competence vira o mês inteiro; settlementNote chega ao serviço', async () => {
    calls.length = 0
    await dispatch({
      auth: reader,
      method: 'GET',
      path: '/v1/expense-occurrences',
      query: { competence: '2026-02', status: 'open' },
    })
    expect(calls[0]?.input).toEqual({ companyId: 'empresa-a', from: '2026-02-01', status: ['open'], to: '2026-02-28' })
    calls.length = 0
    await dispatch({
      auth: writer,
      body: { paidAmount: '10.00', paidAt: '2026-11-20', settlementNote: 'pix' },
      method: 'POST',
      path: `/v1/expense-occurrences/${crypto.randomUUID()}/settlement`,
    })
    expect(calls[0]?.input).toMatchObject({ paidAmount: '10.00', settlementNote: 'pix', via: 'api' })
  })
})
