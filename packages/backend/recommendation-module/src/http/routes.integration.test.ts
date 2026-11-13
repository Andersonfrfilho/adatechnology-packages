/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O trio inteiro pela porta HTTP, contra Postgres de verdade: fábrica, tabela de rotas,
 * despachante, casos de uso e banco. Cada peça já passa sozinha; o que falha é a fiação.
 *
 * Roda com `RECOMMENDATION_TEST_DATABASE_URL` (ou o `DATABASE_URL` do CI); sem banco, fica de fora.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'

import type { CampaignEntitlementPort, RecommendationModuleConfig } from '@adatechnology/recommendation-contracts'

const DATABASE_URL = process.env['RECOMMENDATION_TEST_DATABASE_URL'] ?? process.env['DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

const config: RecommendationModuleConfig = {
  tenancy: { mode: 'single' },
  timeZone: 'America/Sao_Paulo',
  kinds: [
    {
      name: 'place',
      label: 'Lugar',
      fields: [
        {
          name: 'category',
          label: 'Categoria',
          type: 'select',
          required: true,
          options: [
            { value: 'parque', label: 'Parque' },
            { value: 'restaurante', label: 'Restaurante' },
          ],
        },
      ],
    },
  ],
  plans: [
    { name: 'featured', label: 'Destaque', weight: 10 },
    { name: 'basic', label: 'Recomendado', weight: 1 },
  ],
  placements: [
    { name: 'home', label: 'Início', maxSponsored: 2 },
    { name: 'community', label: 'Comunidade' },
  ],
}

const ADMIN = 'recommendations:admin'
const NOW = new Date('2026-11-03T12:00:00Z')

suite('rotas de recomendação ponta a ponta', () => {
  let pool: import('pg').Pool
  let router: { handle(request: Request): Promise<Response> }
  const blocked = new Set<string>()

  async function call(method: string, path: string, body?: unknown, scopes: string | null = ADMIN) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (scopes !== null) headers['x-test-scopes'] = scopes
    const response = await router.handle(
      new Request(`http://local/v1${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    )
    const text = await response.text()
    return { status: response.status, body: text ? (JSON.parse(text) as Record<string, any>) : undefined }
  }

  async function createItem(overrides: Record<string, unknown>) {
    const response = await call('POST', '/recommendation-items', {
      kind: 'place',
      source: 'curated',
      status: 'active',
      title: 'Lugar',
      attributes: { category: 'parque' },
      ...overrides,
    })
    expect(response.status).toBe(201)
    return response.body!['data'] as { id: string }
  }

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { readFile } = await import('node:fs/promises')
    const { createModuleFetchRouter } = await import('@adatechnology/module-http/fetch')
    const { createRecommendationModule } = await import('../RecommendationModule')
    const { recommendationMigrationsFolder } = await import('../runMigrations')
    const { createRecommendationRoutes } = await import('./routes')

    pool = new Pool({ connectionString: DATABASE_URL })
    const db = drizzle({ client: pool })
    // O SQL embarcado, aplicado direto. O migrator do drizzle 1.x recusa o journal no formato 0.x,
    // que é o formato que os hosts atuais (drizzle 0.4x) leem. Rodar duas vezes também prova que o
    // baseline é convergente.
    const baseline = await readFile(`${recommendationMigrationsFolder()}/0000_recommendation_base.sql`, 'utf8')
    for (let run = 0; run < 2; run += 1) {
      for (const statement of baseline.split('--> statement-breakpoint')) await pool.query(statement)
    }

    const entitlement: CampaignEntitlementPort = {
      async isEntitled({ sponsorId }) {
        return !blocked.has(sponsorId)
      },
    }

    const module = createRecommendationModule({
      db,
      config,
      entitlement,
      clock: { now: () => NOW },
      random: { next: () => 0.5 },
    })

    router = createModuleFetchRouter({
      routes: createRecommendationRoutes({ module }),
      basePath: '/v1',
      authResolver: {
        async resolve({ headers }: { headers: Record<string, string> }) {
          const scopes = headers['x-test-scopes']
          if (scopes === undefined) return undefined
          return { companyId: 'single', userId: randomUUID(), scopes: scopes ? scopes.split(',') : [] }
        },
      } as never,
    }) as never
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    blocked.clear()
    await pool.query('truncate "recommendation"."items" cascade')
  })

  it('administração exige o escopo de admin; o feed não', async () => {
    const denied = await call('POST', '/recommendation-items', { kind: 'place', source: 'curated', title: 'X' }, '')
    expect(denied.status).toBe(403)

    const feed = await call('GET', '/recommendations?placement=home', undefined, '')
    expect(feed.status).toBe(200)

    const anonymous = await call('GET', '/recommendations?placement=home', undefined, null)
    expect(anonymous.status).toBe(401)
  })

  it('patrocinado sem anunciante é recusado, e curadoria com anunciante também', async () => {
    const withoutSponsor = await call('POST', '/recommendation-items', {
      kind: 'place',
      source: 'sponsored',
      title: 'Buffet',
      attributes: { category: 'restaurante' },
    })
    expect(withoutSponsor.status).toBe(422)
    expect(withoutSponsor.body?.['error']['code']).toBe('RECOMMENDATION_SPONSOR_REQUIRED')

    const curatedWithSponsor = await call('POST', '/recommendation-items', {
      kind: 'place',
      source: 'curated',
      title: 'Parque',
      sponsorId: randomUUID(),
      attributes: { category: 'parque' },
    })
    expect(curatedWithSponsor.status).toBe(422)
  })

  it('campanha só existe em item patrocinado', async () => {
    const curated = await createItem({ title: 'Parque' })
    const response = await call('POST', `/recommendation-items/${curated.id}/campaigns`, {
      plan: 'featured',
      startsAt: '2026-11-01T00:00:00Z',
    })
    expect(response.status).toBe(422)
  })

  it('o feed põe o patrocinado no ar primeiro, marcado, e respeita cidade, idade, espaço e período', async () => {
    const sponsorId = randomUUID()
    const parque = await createItem({ title: 'Parque da cidade', city: 'Ribeirão Preto', tags: ['ar-livre'] })
    await createItem({ title: 'Museu de outra cidade', city: 'Curitiba' })
    await createItem({ title: 'Brinquedoteca para maiores', minAge: 8 })
    const buffet = await createItem({
      title: 'Buffet infantil',
      source: 'sponsored',
      sponsorId,
      attributes: { category: 'restaurante' },
    })
    const expirado = await createItem({ title: 'Promoção vencida', source: 'sponsored', sponsorId: randomUUID() })
    const soComunidade = await createItem({ title: 'Só na comunidade', source: 'sponsored', sponsorId: randomUUID() })

    const campaign = await call('POST', `/recommendation-items/${buffet.id}/campaigns`, {
      plan: 'featured',
      startsAt: '2026-11-01T00:00:00Z',
      endsAt: '2026-12-01T00:00:00Z',
      placements: ['home'],
    })
    expect(campaign.status).toBe(201)
    await call('POST', `/recommendation-items/${expirado.id}/campaigns`, {
      plan: 'featured',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-10-31T00:00:00Z',
    })
    await call('POST', `/recommendation-items/${soComunidade.id}/campaigns`, {
      plan: 'basic',
      startsAt: '2026-11-01T00:00:00Z',
      placements: ['community'],
    })

    const feed = await call('GET', '/recommendations?placement=home&city=ribeir%C3%A3o%20preto&age=4', undefined, '')
    expect(feed.status).toBe(200)
    const entries = feed.body!['data']['entries'] as { itemId: string; sponsored: boolean; campaignId: string | null }[]

    expect(entries.map((entry) => entry.itemId)).toEqual([buffet.id, parque.id])
    expect(entries[0]?.sponsored).toBe(true)
    expect(entries[0]?.campaignId).toBe(campaign.body!['data']['id'])
    expect(entries[1]?.sponsored).toBe(false)

    const community = await call(
      'GET',
      '/recommendations?placement=community&city=Ribeir%C3%A3o%20Preto',
      undefined,
      '',
    )
    const ids = (community.body!['data']['entries'] as { itemId: string }[]).map((entry) => entry.itemId)
    expect(ids).toContain(soComunidade.id)
    expect(ids).not.toContain(buffet.id)
  })

  it('assinatura vencida tira o anúncio do ar sem pausar a campanha', async () => {
    const sponsorId = randomUUID()
    const buffet = await createItem({ title: 'Buffet', source: 'sponsored', sponsorId })
    await call('POST', `/recommendation-items/${buffet.id}/campaigns`, {
      plan: 'featured',
      startsAt: '2026-11-01T00:00:00Z',
    })

    blocked.add(sponsorId)
    const feed = await call('GET', '/recommendations?placement=home', undefined, '')
    expect(feed.body!['data']['entries']).toEqual([])

    const reopen = await call('POST', `/recommendation-items/${buffet.id}/campaigns`, {
      plan: 'basic',
      startsAt: '2026-11-01T00:00:00Z',
    })
    expect(reopen.status).toBe(402)
  })

  it('conta impressão e clique por dia no fuso do produto', async () => {
    const parque = await createItem({ title: 'Parque' })

    for (const type of ['impression', 'impression', 'click']) {
      const response = await call('POST', '/recommendations/events', { itemId: parque.id, placement: 'home', type }, '')
      expect(response.status).toBe(204)
    }

    const stats = await call('GET', '/recommendation-stats?from=2026-11-03&to=2026-11-03')
    expect(stats.body!['data']).toEqual([
      { itemId: parque.id, campaignId: null, placement: 'home', impressions: 2, clicks: 1 },
    ])
  })

  it('espaço desconhecido é erro do pedido, não lista vazia', async () => {
    const response = await call('GET', '/recommendations?placement=sidebar', undefined, '')
    expect(response.status).toBe(400)
  })

  it('edição mescla atributos e mantém o obrigatório', async () => {
    const parque = await createItem({ title: 'Parque' })
    const cleared = await call('PATCH', `/recommendation-items/${parque.id}`, { attributes: { category: null } })
    expect(cleared.status).toBe(400)

    const renamed = await call('PATCH', `/recommendation-items/${parque.id}`, {
      title: 'Parque novo',
      status: 'paused',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body!['data']['attributes']).toEqual({ category: 'parque' })

    const list = await call('GET', '/recommendation-items?status=paused')
    expect(list.body!['pagination']['total']).toBe(1)
  })
})
