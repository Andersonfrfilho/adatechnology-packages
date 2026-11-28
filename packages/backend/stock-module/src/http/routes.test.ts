/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, it } from 'bun:test'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

import { buildTestModule } from '../testing/buildTestModule'
import { createStockRoutes } from './routes'

const COMPANY_A = '11111111-1111-4111-8111-111111111111'
const COMPANY_B = '22222222-2222-4222-8222-222222222222'
const FLOUR = '33333333-3333-4333-8333-333333333333'

function setup() {
  const { module, catalog } = buildTestModule()
  catalog.ingredients.set(FLOUR, { id: FLOUR, companyId: COMPANY_A, name: 'Farinha', unit: 'kg' })
  const authResolver: AuthContextResolverPort = {
    async resolve({ headers }) {
      const companyId = headers['x-company']
      return companyId
        ? { companyId, userId: 'user-1', scopes: (headers['x-scopes'] ?? 'stock:write').split(',') }
        : undefined
    },
  }
  const router = createModuleFetchRouter({ routes: createStockRoutes({ module }), basePath: '/v1', authResolver })
  return (path: string, init: { method?: string; body?: unknown; company?: string; scopes?: string } = {}) =>
    router.handle(
      new Request(`http://localhost/v1${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...(init.company ? { 'x-company': init.company } : {}),
          ...(init.scopes ? { 'x-scopes': init.scopes } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      }),
    )
}

describe('rotas de estoque', () => {
  it('leitura não escreve; entrada grava; outra empresa 404; id inválido 404', async () => {
    const call = setup()
    const body = { ingredientId: FLOUR, quantity: '2', batchCode: 'L1' }
    expect((await call('/batches', { method: 'POST', company: COMPANY_A, scopes: 'stock:read', body })).status).toBe(
      403,
    )
    expect((await call('/batches', { method: 'POST', company: COMPANY_A, body })).status).toBe(201)
    expect((await call(`/levels/${FLOUR}`, { company: COMPANY_A, scopes: 'stock:read' })).status).toBe(200)
    expect((await call(`/levels/${FLOUR}`, { company: COMPANY_B })).status).toBe(404)
    expect((await call('/levels/nao-uuid', { company: COMPANY_A })).status).toBe(404)
    expect(
      (
        await call('/adjustments', {
          method: 'POST',
          company: COMPANY_A,
          body: { ingredientId: FLOUR, direction: 'decrease', quantity: '1' },
        })
      ).status,
    ).toBe(400)
  })

  it('baixa por pedido só com escopo de serviço', async () => {
    const call = setup()
    const body = { orderId: 'o1', lines: [{ lineKey: 'l1', productId: 'none', quantity: '1' }] }
    expect((await call('/service/orders/deductions', { method: 'POST', company: COMPANY_A, body })).status).toBe(403)
    const response = await call('/service/orders/deductions', {
      method: 'POST',
      company: COMPANY_A,
      scopes: 'stock:service',
      body,
    })
    expect(
      ((await response.json()) as { data: { productsWithoutRecipe: string[] } }).data.productsWithoutRecipe,
    ).toEqual(['none'])
  })
})
