/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O módulo de ponta a ponta pela tabela de rotas, com banco em memória e provedor falso.
 */

import { describe, expect, it } from 'bun:test'

import { compileRoutes, dispatchRoute } from '@adatechnology/module-http'
import type { AuthContext } from '@adatechnology/module-http'
import { PAYMENT_ERROR_CODE } from '@adatechnology/payment-contracts'
import type { PlanDefinition } from '@adatechnology/payment-contracts'

import { createPaymentModule } from './PaymentModule'
import { createPaymentRoutes, PAYMENT_SCOPE } from './http/routes'
import { createFakePaymentProvider, createInMemoryPaymentStore, FAKE_PAYMENT_SECRET_HEADER } from './testing'
import type { FakePaymentWebhookBody } from './testing'

const SECRET = 'segredo-de-teste'
const NOW = new Date('2026-11-12T12:00:00Z')

const PLANS: PlanDefinition[] = [
  { code: 'free', name: 'Gratuito', interval: 'none', features: ['basico'], offers: [], isFree: true },
  {
    code: 'monthly',
    name: 'Premium mensal',
    interval: 'month',
    price: { cents: 1990, currency: 'BRL' },
    features: ['basico', 'premium'],
    offers: [{ provider: 'fake', offerCode: 'off-m', checkoutUrl: 'https://pay.example/m' }],
  },
  {
    code: 'yearly',
    name: 'Premium anual',
    interval: 'year',
    features: ['basico', 'premium', 'extra'],
    offers: [{ provider: 'fake', offerCode: 'off-y', checkoutUrl: 'https://pay.example/y' }],
  },
]

function setup(options: { cancels?: boolean; users?: Record<string, string>; secret?: string | undefined } = {}) {
  const store = createInMemoryPaymentStore()
  const canceled: string[] = []
  const changes: string[] = []
  const users = options.users ?? {}
  const module = createPaymentModule({
    store,
    config: { plans: PLANS },
    providers: [
      createFakePaymentProvider({
        secret: 'secret' in options ? options.secret : SECRET,
        cancels: options.cancels,
        onCancel: (id) => canceled.push(id),
      }),
    ],
    customers: {
      async findByRef({ ref }) {
        return ref in users ? ref : undefined
      },
      async findByEmail({ email }) {
        return Object.entries(users).find(([, value]) => value === email)?.[0]
      },
      async findEmailByRef({ ref }) {
        return users[ref]
      },
    },
    hooks: { onSubscriptionChanged: ({ subscription }) => void changes.push(subscription.status) },
    clock: { now: () => NOW },
  })
  const compiled = compileRoutes(createPaymentRoutes({ module }), '')
  async function call(
    method: string,
    path: string,
    init: { auth?: AuthContext; body?: unknown; headers?: Record<string, string>; query?: Record<string, string> } = {},
  ) {
    const result = await dispatchRoute({
      compiledRoutes: compiled,
      request: {
        method,
        pathname: path,
        query: init.query ?? {},
        headers: init.headers ?? {},
        rawBody: init.body === undefined ? undefined : new TextEncoder().encode(JSON.stringify(init.body)),
      },
      authResolver: { resolve: async () => init.auth },
    })
    if (!result || result.kind !== 'json') throw new Error(`sem resposta json para ${method} ${path}`)
    return result as { status: number; body: any }
  }
  const webhook = (body: FakePaymentWebhookBody, secret = SECRET) =>
    call('POST', '/payments/webhooks/fake', { body, headers: { [FAKE_PAYMENT_SECRET_HEADER]: secret } })
  const user = (userId: string, scopes: string[] = []): AuthContext => ({ companyId: 'c1', userId, scopes })
  return { store, module, call, webhook, user, canceled, changes }
}

const approved = (overrides: Partial<FakePaymentWebhookBody> = {}): FakePaymentWebhookBody => ({
  eventId: 'e1',
  type: 'payment_approved',
  occurredAt: '2026-11-10T10:00:00Z',
  subscriptionId: 'sub-1',
  customerRef: 'u1',
  email: 'pai@example.com',
  offerCode: 'off-m',
  paymentMethod: 'pix',
  amountCents: 1990,
  currency: 'BRL',
  periodEndsAt: '2026-12-10T10:00:00Z',
  ...overrides,
})

describe('configuração', () => {
  it('catálogo sem plano gratuito falha no boot', () => {
    expect(() =>
      createPaymentModule({ store: createInMemoryPaymentStore(), config: { plans: PLANS.slice(1) }, providers: [] }),
    ).toThrow()
  })

  it('o mesmo provedor plugado duas vezes falha no boot', () => {
    const provider = createFakePaymentProvider({ secret: SECRET })
    expect(() =>
      createPaymentModule({
        store: createInMemoryPaymentStore(),
        config: { plans: PLANS },
        providers: [provider, provider],
      }),
    ).toThrow()
  })
})

describe('webhook', () => {
  it('compra aprovada libera o plano da oferta para a pessoa do checkout', async () => {
    const { webhook, call, user, changes } = setup({ users: { u1: 'pai@example.com' } })

    expect((await webhook(approved())).status).toBe(200)
    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(me.body.data).toMatchObject({ planCode: 'monthly', status: 'active', hasAccess: true, paymentMethod: 'pix' })
    expect(changes).toEqual(['active'])
  })

  it('o mesmo evento duas vezes conta uma vez e responde 200 nas duas', async () => {
    const { webhook, store } = setup({ users: { u1: 'pai@example.com' } })

    await webhook(approved())
    const again = await webhook(approved())

    expect(again.status).toBe(200)
    expect(again.body.data.duplicate).toBe(true)
    expect(store.events).toHaveLength(1)
  })

  it('segredo errado é 401 e não grava nada', async () => {
    const { webhook, store } = setup()

    const result = await webhook(approved(), 'outro-segredo-qualquer')

    expect(result.status).toBe(401)
    expect(store.events).toHaveLength(0)
  })

  it('provedor sem credencial responde 503', async () => {
    const { webhook } = setup({ secret: undefined })

    expect((await webhook(approved())).status).toBe(503)
  })

  it('provedor não plugado responde 404', async () => {
    const { call } = setup()

    const result = await call('POST', '/payments/webhooks/outro', { body: approved() })

    expect(result.status).toBe(404)
    expect(result.body.error.code).toBe(PAYMENT_ERROR_CODE.PROVIDER_UNKNOWN)
  })

  it('aprovação atrasada não desfaz um reembolso que já chegou', async () => {
    const { webhook, call, user } = setup({ users: { u1: 'pai@example.com' } })

    await webhook(approved({ eventId: 'e2', type: 'payment_refunded', occurredAt: '2026-11-11T10:00:00Z' }))
    await webhook(approved({ eventId: 'e1' }))
    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(me.body.data).toMatchObject({ status: 'refunded', hasAccess: false, planCode: 'free' })
  })

  it('cancelada continua com acesso até o fim do período pago', async () => {
    const { webhook, call, user } = setup({ users: { u1: 'pai@example.com' } })

    await webhook(approved())
    await webhook(approved({ eventId: 'e2', type: 'subscription_canceled', occurredAt: '2026-11-11T10:00:00Z' }))
    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(me.body.data).toMatchObject({ status: 'canceled', hasAccess: true, planCode: 'monthly' })
  })

  it('oferta fora do catálogo ainda libera o primeiro plano pago', async () => {
    const { webhook, call, user } = setup({ users: { u1: 'pai@example.com' } })

    await webhook(approved({ offerCode: 'oferta-nova' }))
    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(me.body.data.planCode).toBe('monthly')
  })

  it('compra sem conta é amarrada quando a pessoa entra com o mesmo e-mail', async () => {
    const users: Record<string, string> = {}
    const { webhook, call, user, store } = setup({ users })

    await webhook(approved({ customerRef: null, email: 'Novo@Example.com' }))
    expect(store.subscriptions[0]?.customerRef).toBeNull()

    users['u9'] = 'novo@example.com'
    const me = await call('GET', '/payments/me', { auth: user('u9') })

    expect(me.body.data).toMatchObject({ planCode: 'monthly', hasAccess: true })
  })
})

describe('resgate de compra', () => {
  it('quem tem o código da transação resgata a compra sem dono; outra pessoa, não', async () => {
    const { webhook, call, user } = setup()
    await webhook(approved({ customerRef: null, email: 'outro@email.com', transactionId: 'HP123456' }))

    const claimed = await call('POST', '/payments/me/claim', {
      auth: user('u1'),
      body: { provider: 'fake', transactionId: 'HP123456' },
    })
    const stolen = await call('POST', '/payments/me/claim', {
      auth: user('u2'),
      body: { provider: 'fake', transactionId: 'HP123456' },
    })

    expect(claimed.status).toBe(200)
    expect(claimed.body.data).toMatchObject({ planCode: 'monthly', hasAccess: true })
    expect(stolen.status).toBe(404)
    expect(stolen.body.error.code).toBe(PAYMENT_ERROR_CODE.PURCHASE_NOT_CLAIMABLE)
  })

  it('código com caractere estranho nem chega ao banco', async () => {
    const { call, user } = setup()

    const result = await call('POST', '/payments/me/claim', {
      auth: user('u1'),
      body: { provider: 'fake', transactionId: "x' or 1=1" },
    })

    expect(result.status).toBe(400)
  })

  it('e-mail do checkout não amarra compra; só o confirmado', async () => {
    const { webhook, module } = setup({ users: {} })
    await webhook(approved({ customerRef: null, email: 'alvo@email.com' }))

    const typed = await module.useCases.getEntitlement({ customerRef: 'u5', email: 'alvo@email.com' })
    const verified = await module.useCases.getEntitlement({ customerRef: 'u6', verifiedEmail: 'alvo@email.com' })

    expect(typed.hasAccess).toBe(false)
    expect(verified.hasAccess).toBe(true)
  })
})

describe('rotas da pessoa', () => {
  it('sem sessão é 401', async () => {
    const { call } = setup()

    expect((await call('GET', '/payments/me')).status).toBe(401)
  })

  it('sem assinatura fica no plano gratuito', async () => {
    const { call, user } = setup()

    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(me.body.data).toMatchObject({ planCode: 'free', status: 'none', hasAccess: false, features: ['basico'] })
  })

  it('planos trazem o checkout marcado com a pessoa logada, nunca com id do corpo', async () => {
    const { call, user } = setup()

    const plans = await call('GET', '/payments/plans', { auth: user('u1') })
    const monthly = plans.body.data.find((plan: { code: string }) => plan.code === 'monthly')

    expect(monthly.checkouts[0].url).toBe('https://pay.example/m?ref=u1')
    expect(plans.body.data.find((plan: { current: boolean }) => plan.current).code).toBe('free')
  })

  it('requireFeature responde 402 para quem não tem o plano', async () => {
    const { module } = setup()

    await expect(module.useCases.requireFeature({ customerRef: 'u1' }, 'premium')).rejects.toMatchObject({
      statusCode: 402,
    })
  })

  it('sem provedor que cancele, a rota de cancelar não existe', async () => {
    const { call, user } = setup()

    expect(await call('POST', '/payments/me/cancel', { auth: user('u1') }).catch(() => 'sem rota')).toBe('sem rota')
  })

  it('com provedor que cancela, cancela pela API e mantém o acesso até o fim do período', async () => {
    const { webhook, call, user, canceled } = setup({ cancels: true, users: { u1: 'pai@example.com' } })
    await webhook(approved())

    const result = await call('POST', '/payments/me/cancel', { auth: user('u1') })
    const me = await call('GET', '/payments/me', { auth: user('u1') })

    expect(result.status).toBe(200)
    expect(canceled).toEqual(['sub-1'])
    expect(me.body.data).toMatchObject({ status: 'canceled', hasAccess: true })
  })
})

describe('painel', () => {
  it('sem o escopo payments:read é 403', async () => {
    const { call, user } = setup()

    expect((await call('GET', '/payments/admin/overview', { auth: user('u1') })).status).toBe(403)
  })

  it('resumo, assinantes e eventos', async () => {
    const { webhook, call, user } = setup({ users: { u1: 'pai@example.com' } })
    await webhook(approved())
    await webhook(
      approved({
        eventId: 'e3',
        subscriptionId: 'sub-2',
        customerRef: null,
        email: 'sem@conta.com',
        offerCode: 'off-y',
        paymentMethod: 'credit_card',
        amountCents: 19900,
      }),
    )
    const admin = user('admin', [PAYMENT_SCOPE.READ])

    const overview = await call('GET', '/payments/admin/overview', { auth: admin })
    const subscriptions = await call('GET', '/payments/admin/subscriptions', { auth: admin, query: { search: 'sem@' } })
    const events = await call('GET', '/payments/admin/events', { auth: admin, query: { perPage: '1' } })

    expect(overview.body.data).toMatchObject({
      byStatus: { active: 2 },
      revenue30d: [{ currency: 'BRL', cents: 21890, payments: 2 }],
      unlinked: 1,
    })
    expect(subscriptions.body.data).toHaveLength(1)
    expect(subscriptions.body.pagination.total).toBe(1)
    expect(events.body.data).toHaveLength(1)
    expect(events.body.pagination.total).toBe(2)
  })
})
