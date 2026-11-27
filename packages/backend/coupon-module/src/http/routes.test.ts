/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas reais sobre o adaptador fetch: escopos, BOLA (404), público com limitador, exportação binária.
 */

import { describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { AuthContextResolverPort } from '@adatechnology/module-http'
import { createModuleFetchRouter } from '@adatechnology/module-http/fetch'

import { buildTestModule } from '../testing/buildTestModule'
import { createCouponRoutes } from './routes'

const COMPANY_A = randomUUID()
const COMPANY_B = randomUUID()

function setup(params: { allowed?: boolean } = {}) {
  const { module, persistence } = buildTestModule()
  const consumed: string[] = []
  const authResolver: AuthContextResolverPort = {
    async resolve({ headers }) {
      const companyId = headers['x-company']
      return companyId
        ? { companyId, userId: 'user-1', scopes: (headers['x-scopes'] ?? 'coupons:admin').split(',') }
        : undefined
    },
  }
  const routes = createCouponRoutes({
    module,
    public: {
      companyResolver: { resolve: async ({ headers }) => (headers.host === 'loja.a.test' ? COMPANY_A : undefined) },
      rateLimiter: {
        async consume({ action, key }) {
          consumed.push(`${action} ${key}`)
          return params.allowed === false ? { allowed: false, retryAfterSeconds: 30 } : { allowed: true }
        },
      },
    },
  })
  const router = createModuleFetchRouter({ routes, basePath: '/v1', authResolver })
  const call = (
    path: string,
    init: {
      method?: string
      body?: unknown
      company?: string
      scopes?: string
      host?: string
      ip?: string | null
    } = {},
  ) =>
    router.handle(
      new Request(`http://localhost/v1${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...(init.company ? { 'x-company': init.company } : {}),
          ...(init.scopes ? { 'x-scopes': init.scopes } : {}),
          ...(init.host ? { host: init.host } : {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
      init.ip === null ? {} : { ip: init.ip ?? '203.0.113.9' },
    )
  return { call, persistence, consumed }
}

const CAMPAIGN = {
  name: 'Inauguração',
  title: 'Ganhe 10%',
  isActive: true,
  fixedCode: 'BEMVINDO',
  discount: { kind: 'percent', value: 10 },
  leadCapture: { enabled: true, consentText: 'Aceito (LGPD).' },
}

async function createCampaign(call: ReturnType<typeof setup>['call']): Promise<string> {
  const response = await call('/campaigns', { method: 'POST', company: COMPANY_A, body: CAMPAIGN })
  expect(response.status).toBe(201)
  return ((await response.json()) as { data: { id: string } }).data.id
}

describe('rotas do painel', () => {
  it('sem escopo: 403; sem identidade: 401', async () => {
    const { call } = setup()
    expect((await call('/campaigns', { company: COMPANY_A, scopes: 'content:admin' })).status).toBe(403)
    expect((await call('/campaigns')).status).toBe(401)
  })

  it('campanha de outra empresa é 404 em toda rota com :id', async () => {
    const { call } = setup()
    const id = await createCampaign(call)
    for (const path of [
      `/campaigns/${id}`,
      `/campaigns/${id}/report`,
      `/campaigns/${id}/codes`,
      `/campaigns/${id}/leads/export`,
    ])
      expect((await call(path, { company: COMPANY_B })).status).toBe(404)
  })

  it('validação de corpo devolve 400 com os campos', async () => {
    const { call } = setup()
    const response = await call('/campaigns', {
      method: 'POST',
      company: COMPANY_A,
      body: { name: '', discount: { kind: 'percent', value: 500 } },
    })
    expect(response.status).toBe(400)
  })

  it('exporta XLSX como arquivo para baixar', async () => {
    const { call } = setup()
    const id = await createCampaign(call)
    const response = await call(`/campaigns/${id}/leads/export?format=xlsx`, { company: COMPANY_A })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="leads-2026-11-20.xlsx"')
    expect([...new Uint8Array(await response.arrayBuffer()).subarray(0, 2)]).toEqual([0x50, 0x4b])
  })
})

describe('rotas de serviço', () => {
  it('resgate 201, repetição 200, liberação idempotente', async () => {
    const { call } = setup()
    await createCampaign(call)
    const body = {
      code: 'bemvindo',
      orderRef: { kind: 'order', id: '42' },
      items: [{ productId: 'p', priceCents: 2_000, quantity: 2 }],
    }
    const scopes = 'coupons:service'
    expect((await call('/redemptions', { method: 'POST', company: COMPANY_A, scopes, body })).status).toBe(201)
    const again = await call('/redemptions', { method: 'POST', company: COMPANY_A, scopes, body })
    expect(again.status).toBe(200)
    expect(((await again.json()) as { data: { discountCents: number } }).data.discountCents).toBe(400)
    const release = { orderRef: body.orderRef }
    expect(
      (await call('/redemptions/release', { method: 'POST', company: COMPANY_A, scopes, body: release })).status,
    ).toBe(200)
    const repeated = await call('/redemptions/release', { method: 'POST', company: COMPANY_A, scopes, body: release })
    expect(((await repeated.json()) as { data: { status: string } }).data.status).toBe('released')
  })

  it('recusa vem 422 com os motivos', async () => {
    const { call } = setup()
    await createCampaign(call)
    const response = await call('/redemptions', {
      method: 'POST',
      company: COMPANY_A,
      scopes: 'coupons:service',
      body: { code: 'BEMVINDO', orderRef: { kind: 'order', id: '1' }, items: [] },
    })
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error: { details: { reasons: string[] } } }).error.details.reasons).toEqual([
      'empty_cart',
    ])
  })
})

describe('rotas públicas', () => {
  it('banner sem código; empresa desconhecida é 404', async () => {
    const { call } = setup()
    await createCampaign(call)
    const response = await call('/public/campaigns', { host: 'loja.a.test' })
    expect(response.headers.get('cache-control')).toContain('max-age')
    const text = await response.text()
    expect(text).toContain('Ganhe 10%')
    expect(text).not.toContain('BEMVINDO')
    expect((await call('/public/campaigns', { host: 'outra.test' })).status).toBe(404)
  })

  it('captação passa pelo limitador e devolve o código', async () => {
    const { call, consumed } = setup()
    const id = await createCampaign(call)
    const response = await call(`/public/campaigns/${id}/leads`, {
      method: 'POST',
      host: 'loja.a.test',
      body: { phone: '(11) 98765-4321', email: 'ana@exemplo.com', consent: true },
    })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { data: { couponCode: string } }).data.couponCode).toBe('BEMVINDO')
    expect(consumed).toEqual(['lead-capture 203.0.113.9', `lead-capture-campaign ${COMPANY_A}:${id}`])
    const repeated = await call(`/public/campaigns/${id}/leads`, {
      method: 'POST',
      host: 'loja.a.test',
      body: { phone: '(11) 98765-4321', email: 'ana@exemplo.com', consent: true },
    })
    expect(repeated.status).toBe(200)
  })

  it('limitador recusando: 429 com Retry-After, nada gravado', async () => {
    const { call, persistence } = setup({ allowed: false })
    const id = await createCampaign(call)
    const response = await call(`/public/campaigns/${id}/leads`, {
      method: 'POST',
      host: 'loja.a.test',
      body: { phone: '11987654321', email: 'ana@exemplo.com', consent: true },
    })
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(persistence.state.leads).toHaveLength(0)
    expect(
      (
        await call('/public/coupons/validate', {
          method: 'POST',
          host: 'loja.a.test',
          body: { code: 'X1X', items: [] },
        })
      ).status,
    ).toBe(429)
  })

  it('prévia pública não aceita identidade nem relógio do cliente', async () => {
    const { call } = setup()
    await createCampaign(call)
    const response = await call('/public/coupons/validate', {
      method: 'POST',
      host: 'loja.a.test',
      body: {
        code: 'BEMVINDO',
        items: [{ productId: 'p', priceCents: 1_000, quantity: 1 }],
        customerRef: 'x',
        at: '2020-01-01T00:00:00Z',
      },
    })
    const { data } = (await response.json()) as { data: { valid: boolean; discountCents: number } }
    expect(data).toMatchObject({ valid: true, discountCents: 100 })
  })

  it('sem IP resolvido, prévia e captação recusam (fail-closed) sem consultar o limitador', async () => {
    const { call, consumed, persistence } = setup()
    const id = await createCampaign(call)
    const capture = await call(`/public/campaigns/${id}/leads`, {
      method: 'POST',
      host: 'loja.a.test',
      ip: null,
      body: { phone: '11987654321', email: 'ana@exemplo.com', consent: true },
    })
    expect(capture.status).toBe(429)
    const preview = await call('/public/coupons/validate', {
      method: 'POST',
      host: 'loja.a.test',
      ip: null,
      body: { code: 'BEMVINDO', items: [] },
    })
    expect(preview.status).toBe(429)
    expect(consumed).toEqual([])
    expect(persistence.state.leads).toHaveLength(0)
  })

  it('prévia recusada sai genérica: sem motivo, campanha nem código', async () => {
    const { call } = setup()
    await createCampaign(call)
    for (const code of ['BEMVINDO', 'NAOEXISTE']) {
      const response = await call('/public/coupons/validate', {
        method: 'POST',
        host: 'loja.a.test',
        body: { code, items: [] },
      })
      const { data } = (await response.json()) as { data: Record<string, unknown> }
      expect(data).toEqual({
        valid: false,
        discountCents: 0,
        subtotalCents: 0,
        eligibleSubtotalCents: 0,
        reasons: ['not_applicable'],
      })
    }
  })

  it('serviço continua com os motivos detalhados', async () => {
    const { call } = setup()
    await createCampaign(call)
    const response = await call('/coupons/validate', {
      method: 'POST',
      company: COMPANY_A,
      scopes: 'coupons:service',
      body: { code: 'BEMVINDO', items: [] },
    })
    const { data } = (await response.json()) as { data: { reasons: string[]; campaign: unknown } }
    expect(data.reasons).toEqual(['empty_cart'])
    expect(data.campaign).toBeDefined()
  })

  it('cache público varia por Host', async () => {
    const { call } = setup()
    await createCampaign(call)
    expect((await call('/public/campaigns', { host: 'loja.a.test' })).headers.get('vary')).toBe('Host')
  })
})

describe('ids no caminho', () => {
  it('id que não é UUID responde 404, igual a inexistente (nunca 500)', async () => {
    const { call } = setup()
    const id = await createCampaign(call)
    expect((await call('/campaigns/nao-e-uuid', { company: COMPANY_A })).status).toBe(404)
    expect(
      (await call(`/campaigns/${id}/codes/x`, { method: 'PATCH', company: COMPANY_A, body: { status: 'disabled' } }))
        .status,
    ).toBe(404)
    expect((await call(`/campaigns/${id}/leads/x`, { method: 'DELETE', company: COMPANY_A })).status).toBe(404)
    expect((await call('/public/campaigns/x', { host: 'loja.a.test' })).status).toBe(404)
    const capture = await call('/public/campaigns/x/leads', {
      method: 'POST',
      host: 'loja.a.test',
      body: { phone: '11987654321', consent: true },
    })
    expect(capture.status).toBe(404)
  })

  it('LGPD: apagar o contato pela rota do painel, escopado pela empresa', async () => {
    const { call, persistence } = setup()
    const id = await createCampaign(call)
    await call(`/public/campaigns/${id}/leads`, {
      method: 'POST',
      host: 'loja.a.test',
      body: { phone: '11987654321', email: 'ana@exemplo.com', consent: true },
    })
    const leadId = persistence.state.leads[0]?.id ?? ''
    expect((await call(`/campaigns/${id}/leads/${leadId}`, { method: 'DELETE', company: COMPANY_B })).status).toBe(404)
    expect((await call(`/campaigns/${id}/leads/${leadId}`, { method: 'DELETE', company: COMPANY_A })).status).toBe(204)
    expect(persistence.state.leads[0]).toMatchObject({
      name: null,
      phone: null,
      email: null,
      customerRef: null,
      couponCode: null,
    })
  })
})
