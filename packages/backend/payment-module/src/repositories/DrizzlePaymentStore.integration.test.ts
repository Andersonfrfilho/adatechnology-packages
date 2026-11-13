/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O `DrizzlePaymentStore` contra Postgres de verdade: migração, idempotência, ordem dos eventos,
 * amarração por e-mail e o painel. Pula sem `PAYMENT_TEST_DATABASE_URL`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'

import type { PaymentEvent, PlanDefinition } from '@adatechnology/payment-contracts'

const DATABASE_URL = process.env['PAYMENT_TEST_DATABASE_URL']
const suite = DATABASE_URL ? describe : describe.skip

const PLANS: PlanDefinition[] = [
  { code: 'free', name: 'Gratuito', interval: 'none', features: [], offers: [], isFree: true },
  {
    code: 'monthly',
    name: 'Mensal',
    interval: 'month',
    features: ['premium'],
    offers: [{ provider: 'fake', offerCode: 'off-m' }],
  },
]
const NOW = new Date('2026-11-12T12:00:00Z')

function event(overrides: Partial<PaymentEvent> = {}): PaymentEvent {
  return {
    provider: 'fake',
    eventId: 'e1',
    type: 'payment_approved',
    providerEventType: 'payment_approved',
    occurredAt: new Date('2026-11-10T10:00:00Z'),
    subscriptionId: 'sub-1',
    transactionId: 't1',
    customer: { email: 'Pai@Example.com', name: 'Pai' },
    customerRef: null,
    offerCode: 'off-m',
    planName: null,
    paymentMethod: 'pix',
    amount: { cents: 1990, currency: 'BRL' },
    periodEndsAt: new Date('2026-12-10T10:00:00Z'),
    ...overrides,
  }
}

suite('DrizzlePaymentStore (Postgres)', () => {
  let pool: import('pg').Pool
  let module: import('../PaymentModule').PaymentModule
  let parse: (next: PaymentEvent) => void

  beforeAll(async () => {
    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { paymentMigrationsFolder } = await import('../runMigrations')
    const { createPaymentModule } = await import('../PaymentModule')

    pool = new Pool({ connectionString: DATABASE_URL })
    await pool.query('drop schema if exists payment cascade')
    // O SQL embarcado, aplicado direto: o migrator do drizzle 1.x (dev daqui) recusa o journal no
    // formato 0.x, que é o que os hosts usam. Duas vezes, porque o SQL é convergente.
    const journal = JSON.parse(readFileSync(join(paymentMigrationsFolder(), 'meta', '_journal.json'), 'utf8')) as {
      entries: { tag: string }[]
    }
    for (let round = 0; round < 2; round += 1) {
      for (const { tag } of journal.entries) {
        const migration = readFileSync(join(paymentMigrationsFolder(), `${tag}.sql`), 'utf8')
        for (const statement of migration.split('--> statement-breakpoint')) await pool.query(statement)
      }
    }
    const db = drizzle({ client: pool })

    let next: PaymentEvent = event()
    parse = (value) => (next = value)
    module = createPaymentModule({
      db,
      config: { plans: PLANS },
      providers: [
        {
          name: 'fake',
          paymentMethods: ['pix'],
          isConfigured: () => true,
          parseWebhook: async () => next,
          buildCheckoutUrl: ({ checkoutUrl }) => checkoutUrl,
        },
      ],
      customers: {
        findByRef: async () => undefined,
        findByEmail: async () => undefined,
        findEmailByRef: async ({ ref }) => (ref === 'u1' ? 'pai@example.com' : undefined),
      },
      clock: { now: () => NOW },
    })
  })

  beforeEach(async () => {
    await pool.query('truncate payment.payment_events, payment.subscriptions')
  })

  afterAll(async () => {
    await pool?.end()
  })

  const receive = async (value: PaymentEvent) => {
    parse(value)
    return module.useCases.receiveWebhook({ provider: 'fake', headers: {}, rawBody: '{}' })
  }

  it('grava uma vez só o mesmo evento', async () => {
    expect((await receive(event())).duplicate).toBe(false)
    expect((await receive(event())).duplicate).toBe(true)
    const { rows } = await pool.query('select count(*)::int as n from payment.payment_events')
    expect(rows[0].n).toBe(1)
  })

  it('evento atrasado não desfaz o mais novo', async () => {
    await receive(event({ eventId: 'e2', type: 'payment_refunded', occurredAt: new Date('2026-11-11T10:00:00Z') }))
    await receive(event())
    const { rows } = await pool.query('select status from payment.subscriptions')
    expect(rows).toEqual([{ status: 'refunded' }])
  })

  it('compra sem conta é amarrada pelo e-mail e libera o plano', async () => {
    await receive(event())

    const entitlement = await module.useCases.getEntitlement({ customerRef: 'u1' })

    expect(entitlement).toMatchObject({ planCode: 'monthly', hasAccess: true, status: 'active' })
    const { rows } = await pool.query('select customer_ref from payment.payment_events')
    expect(rows[0].customer_ref).toBeNull()
  })

  it('resgate pelo código da transação: só compra sem dono, e só uma vez', async () => {
    await receive(event({ transactionId: 'HP-777' }))

    const mine = await module.useCases.claimPurchase(
      { customerRef: 'u7' },
      { provider: 'fake', transactionId: 'HP-777' },
    )
    const again = await module.useCases.claimPurchase(
      { customerRef: 'u7' },
      { provider: 'fake', transactionId: 'HP-777' },
    )
    const other = module.useCases.claimPurchase({ customerRef: 'u8' }, { provider: 'fake', transactionId: 'HP-777' })
    const missing = module.useCases.claimPurchase({ customerRef: 'u8' }, { provider: 'fake', transactionId: 'HP-000' })

    expect(mine).toMatchObject({ planCode: 'monthly', hasAccess: true })
    expect(again).toMatchObject({ planCode: 'monthly', hasAccess: true })
    await expect(other).rejects.toMatchObject({ statusCode: 404 })
    await expect(missing).rejects.toMatchObject({ statusCode: 404 })
    const { rows } = await pool.query('select customer_ref from payment.payment_events')
    expect(rows).toEqual([{ customer_ref: 'u7' }])
  })

  it('painel: resumo, busca e eventos', async () => {
    await receive(event())
    await receive(
      event({
        eventId: 'e3',
        subscriptionId: 'sub-2',
        customer: { email: 'outro@x.com', name: 'Outro' },
        paymentMethod: 'credit_card',
      }),
    )

    const overview = await module.useCases.overview()
    const search = await module.useCases.listSubscriptions({ page: 1, perPage: 20, search: 'outro' })
    const events = await module.useCases.listEvents({ page: 1, perPage: 1 })

    expect(overview).toMatchObject({
      byStatus: { active: 2 },
      withAccessByPlan: [{ planCode: 'monthly', count: 2 }],
      revenue30d: [{ currency: 'BRL', cents: 3980, payments: 2 }],
      unlinked: 2,
    })
    expect(overview.methods30d).toHaveLength(2)
    expect(search.total).toBe(1)
    expect(events).toMatchObject({ total: 2 })
    expect(events.rows).toHaveLength(1)
  })
})
