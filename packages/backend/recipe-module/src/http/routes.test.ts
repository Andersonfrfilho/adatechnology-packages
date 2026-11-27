/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas reais sobre o adaptador fetch: escopos de leitura e escrita, empresa do token (BOLA = 404),
 * id inválido = 404, validação de corpo e exportação binária.
 */

import { describe, expect, it } from 'bun:test'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

import { buildTestModule } from '../testing/buildTestModule'
import { createRecipeRoutes } from './routes'

const COMPANY_A = '11111111-1111-4111-8111-111111111111'
const COMPANY_B = '22222222-2222-4222-8222-222222222222'

function setup() {
  const { module } = buildTestModule()
  const authResolver: AuthContextResolverPort = {
    async resolve({ headers }) {
      const companyId = headers['x-company']
      return companyId
        ? { companyId, userId: 'user-1', scopes: (headers['x-scopes'] ?? 'recipes:write').split(',') }
        : undefined
    },
  }
  const router = createModuleFetchRouter({ routes: createRecipeRoutes({ module }), basePath: '/v1', authResolver })
  const call = (path: string, init: { method?: string; body?: unknown; company?: string; scopes?: string } = {}) =>
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
  return { call }
}

async function dataOf(response: Response): Promise<any> {
  return ((await response.json()) as { data: unknown }).data
}

describe('rotas', () => {
  it('sem identidade 401; só leitura não escreve (403) mas lê', async () => {
    const { call } = setup()
    expect((await call('/ingredients')).status).toBe(401)
    const created = await call('/ingredients', {
      method: 'POST',
      company: COMPANY_A,
      body: { name: 'Farinha', unit: 'kg', costPerUnit: '5' },
    })
    expect(created.status).toBe(201)
    expect((await call('/ingredients', { company: COMPANY_A, scopes: 'recipes:read' })).status).toBe(200)
    const denied = await call('/ingredients', {
      method: 'POST',
      company: COMPANY_A,
      scopes: 'recipes:read',
      body: { name: 'X', unit: 'g' },
    })
    expect(denied.status).toBe(403)
  })

  it('empresa vem do token: outra empresa recebe 404; id que não é UUID também', async () => {
    const { call } = setup()
    const ingredient = await dataOf(
      await call('/ingredients', {
        method: 'POST',
        company: COMPANY_A,
        body: { name: 'Farinha', unit: 'kg', companyId: COMPANY_B },
      }),
    )
    expect(ingredient.companyId).toBe(COMPANY_A)
    expect((await call(`/ingredients/${ingredient.id}`, { company: COMPANY_B })).status).toBe(404)
    expect((await call('/ingredients/nao-e-uuid', { company: COMPANY_A })).status).toBe(404)
    expect((await call('/recipes/com%20espaco', { company: COMPANY_A })).status).toBe(404)
  })

  it('corpo inválido 400; ficha com custo e margem; apagar insumo em uso 409', async () => {
    const { call } = setup()
    expect(
      (await call('/ingredients', { method: 'POST', company: COMPANY_A, body: { name: '', unit: 'xx' } })).status,
    ).toBe(400)
    const flour = await dataOf(
      await call('/ingredients', {
        method: 'POST',
        company: COMPANY_A,
        body: { name: 'Farinha', unit: 'kg', costPerUnit: '5' },
      }),
    )
    const saved = await call('/recipes/p-1?salePriceCents=1000', {
      method: 'PUT',
      company: COMPANY_A,
      body: { yieldPortions: '2', lines: [{ ingredientId: flour.id, quantity: '400', unit: 'g' }] },
    })
    expect(saved.status).toBe(200)
    expect((await dataOf(saved)).cost).toMatchObject({
      totalCostCents: 200,
      costPerPortionCents: 100,
      marginBasisPoints: 9000,
    })
    const removal = await call(`/ingredients/${flour.id}`, { method: 'DELETE', company: COMPANY_A })
    expect(removal.status).toBe(409)
    expect(((await removal.json()) as any).error.details).toEqual({ productIds: ['p-1'] })
    expect((await call('/recipes/p-1', { method: 'DELETE', company: COMPANY_A })).status).toBe(204)
    expect((await call(`/ingredients/${flour.id}`, { method: 'DELETE', company: COMPANY_A })).status).toBe(204)
  })

  it('exporta insumos e lista de compras como arquivo', async () => {
    const { call } = setup()
    await call('/ingredients', { method: 'POST', company: COMPANY_A, body: { name: 'Farinha', unit: 'kg' } })
    const csv = await call('/ingredients/export?format=csv', { company: COMPANY_A })
    expect(csv.status).toBe(200)
    expect(csv.headers.get('content-disposition')).toContain('insumos-')
    expect(await csv.text()).toContain('Farinha')
    const list = await call('/shopping-lists/export', {
      method: 'POST',
      company: COMPANY_A,
      body: { items: [{ productId: 'p', quantity: '1' }], format: 'xlsx' },
    })
    expect(list.headers.get('content-type')).toContain('spreadsheetml')
  })

  it('rota de serviço exige o escopo de serviço', async () => {
    const { call } = setup()
    const body = { productIds: ['p'] }
    expect((await call('/service/recipes/lookup', { method: 'POST', company: COMPANY_A, body })).status).toBe(403)
    const allowed = await call('/service/recipes/lookup', {
      method: 'POST',
      company: COMPANY_A,
      scopes: 'recipes:service',
      body,
    })
    expect(await dataOf(allowed)).toEqual({ recipes: [], ingredients: [] })
  })
})
