/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Respostas no formato da API do Mercado Pago, escritas à mão: nenhum teste fala com o Mercado Pago.
 */

import { describe, expect, test } from 'bun:test'

import {
  PaymentConfigInvalidError,
  PaymentWebhookInvalidError,
  PaymentWebhookUnauthorizedError,
  supportsCharges,
} from '@adatechnology/payment-contracts'

import {
  buildMercadoPagoManifest,
  createMercadoPagoPaymentProvider,
  MERCADOPAGO_REQUEST_ID_HEADER,
  MERCADOPAGO_SIGNATURE_HEADER,
  MercadoPagoApiError,
  signMercadoPagoWebhook,
} from './MercadoPagoPaymentProvider'
import type { FetchLike } from './MercadoPagoPaymentProvider'

const SECRET = 'segredo-de-teste'
const TOKEN = 'TEST-token'

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

function fakeApi(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = []
  const fetcher: FetchLike = async (url, init) => {
    const method = init?.method ?? 'GET'
    calls.push({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const path = new URL(url).pathname
    const route = routes[`${method} ${path}`]
    if (!route) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 })
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 })
  }
  return { calls, fetcher }
}

function webhook(body: unknown, options: { secret?: string; requestId?: string; ts?: string } = {}) {
  const requestId = options.requestId ?? 'req-1'
  const ts = options.ts ?? '1767225600'
  const dataId = (body as { data?: { id?: string } }).data?.id ?? null
  return {
    headers: {
      [MERCADOPAGO_SIGNATURE_HEADER]: signMercadoPagoWebhook({
        secret: options.secret ?? SECRET,
        dataId,
        requestId,
        ts,
      }),
      [MERCADOPAGO_REQUEST_ID_HEADER]: requestId,
    },
    rawBody: new TextEncoder().encode(JSON.stringify(body)),
  }
}

const NOTIFICATION = {
  action: 'payment.updated',
  type: 'payment',
  data: { id: '123456789' },
  date_created: '2026-11-13T13:00:00Z',
}

const APPROVED_PAYMENT = {
  id: 123456789,
  status: 'approved',
  payment_method_id: 'pix',
  payment_type_id: 'bank_transfer',
  transaction_amount: 57.9,
  currency_id: 'BRL',
  external_reference: 'order-42',
  date_approved: '2026-11-13T13:05:00.000-03:00',
  date_last_updated: '2026-11-13T13:05:01.000-03:00',
  payer: { email: 'Cliente@Example.com', first_name: 'Maria', identification: { number: '00000000000' } },
}

describe('cobrança', () => {
  test('é um provedor que cobra avulso', () => {
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET })
    expect(supportsCharges(provider)).toBe(true)
    expect(provider.isConfigured()).toBe(true)
    expect(createMercadoPagoPaymentProvider({ accessToken: '', webhookSecret: SECRET }).isConfigured()).toBe(false)
  })

  test('Pix: manda valor em reais, referência, expiração e idempotência; devolve copia-e-cola e QR', async () => {
    const api = fakeApi({
      'POST /v1/payments': {
        status: 201,
        body: {
          id: 987,
          status: 'pending',
          date_of_expiration: '2026-11-13T14:00:00.000-03:00',
          point_of_interaction: {
            transaction_data: {
              qr_code: '00020126...6304ABCD',
              qr_code_base64: 'iVBORw0KGgo=',
              ticket_url: 'https://mp/ticket',
            },
          },
        },
      },
    })
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fallbackPayerEmail: 'loja@example.com',
      fetch: api.fetcher,
    })
    const charge = await provider.createCharge({
      kind: 'pix',
      amount: { cents: 5790, currency: 'BRL' },
      reference: 'order-42',
      description: 'Pedido #42',
      idempotencyKey: 'order-42-pix',
      expiresAt: new Date('2026-11-13T17:00:00Z'),
      notificationUrl: 'https://api.example.com/webhooks/payments/mercadopago/est-1',
    })
    expect(charge).toMatchObject({
      provider: 'mercadopago',
      id: '987',
      kind: 'pix',
      status: 'pending',
      reference: 'order-42',
      pix: { copyPaste: '00020126...6304ABCD', qrCodeBase64: 'iVBORw0KGgo=', ticketUrl: 'https://mp/ticket' },
      paymentMethod: 'pix',
    })
    const [call] = api.calls
    expect(call?.headers['Authorization']).toBe(`Bearer ${TOKEN}`)
    expect(call?.headers['X-Idempotency-Key']).toBe('order-42-pix')
    expect(call?.body).toMatchObject({
      transaction_amount: 57.9,
      payment_method_id: 'pix',
      external_reference: 'order-42',
      date_of_expiration: '2026-11-13T17:00:00.000+00:00',
      notification_url: 'https://api.example.com/webhooks/payments/mercadopago/est-1',
      payer: { email: 'loja@example.com' },
    })
  })

  test('Pix sem e-mail nenhum é recusado antes de chamar a API', async () => {
    const api = fakeApi({})
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    await expect(
      provider.createCharge({
        kind: 'pix',
        amount: { cents: 1000, currency: 'BRL' },
        reference: 'order-1',
        description: 'Pedido',
        idempotencyKey: 'k',
        expiresAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(PaymentConfigInvalidError)
    expect(api.calls).toHaveLength(0)
  })

  test('link de cartão: preferência sem boleto, à vista, com init_point', async () => {
    const api = fakeApi({
      'POST /checkout/preferences': {
        status: 201,
        body: { id: 'pref-1', init_point: 'https://mp/checkout?pref_id=pref-1' },
      },
    })
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    const charge = await provider.createCharge({
      kind: 'payment_link',
      amount: { cents: 5790, currency: 'BRL' },
      reference: 'order-42',
      description: 'Pedido #42',
      idempotencyKey: 'order-42-link',
      expiresAt: new Date('2026-11-13T17:00:00Z'),
    })
    expect(charge).toMatchObject({
      id: 'pref-1',
      kind: 'payment_link',
      paymentUrl: 'https://mp/checkout?pref_id=pref-1',
    })
    expect(api.calls[0]?.body).toMatchObject({
      items: [{ unit_price: 57.9, quantity: 1, currency_id: 'BRL' }],
      external_reference: 'order-42',
      payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 1 },
    })
  })

  test('valor em centavos não inteiro é recusado', async () => {
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fetch: fakeApi({}).fetcher,
    })
    await expect(
      provider.createCharge({
        kind: 'pix',
        amount: { cents: 10.5, currency: 'BRL' },
        reference: 'r',
        description: 'd',
        idempotencyKey: 'k',
        expiresAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(PaymentConfigInvalidError)
  })

  test('erro da API vira MercadoPagoApiError com o status', async () => {
    const api = fakeApi({ 'POST /v1/payments': { status: 401, body: { message: 'invalid access token' } } })
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fallbackPayerEmail: 'a@b.com',
      fetch: api.fetcher,
    })
    const attempt = provider.createCharge({
      kind: 'pix',
      amount: { cents: 100, currency: 'BRL' },
      reference: 'r',
      description: 'd',
      idempotencyKey: 'k',
      expiresAt: new Date(),
    })
    await expect(attempt).rejects.toBeInstanceOf(MercadoPagoApiError)
    await expect(attempt).rejects.toMatchObject({ httpStatus: 401, statusCode: 503 })
  })

  test('cancela Pix pendente', async () => {
    const api = fakeApi({ 'PUT /v1/payments/987': { body: { id: 987, status: 'cancelled' } } })
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    await provider.cancelCharge?.({ id: '987' })
    expect(api.calls[0]).toMatchObject({ method: 'PUT', body: { status: 'cancelled' } })
  })
})

describe('webhook do Mercado Pago', () => {
  test('pagamento aprovado: lê o estado na API, não no corpo', async () => {
    const api = fakeApi({ 'GET /v1/payments/123456789': { body: APPROVED_PAYMENT } })
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    const event = await provider.parseWebhook(webhook(NOTIFICATION))
    expect(event).toMatchObject({
      provider: 'mercadopago',
      eventId: '123456789:approved',
      type: 'payment_approved',
      providerEventType: 'payment.approved',
      transactionId: '123456789',
      customerRef: 'order-42',
      customer: { email: 'cliente@example.com', name: 'Maria' },
      paymentMethod: 'pix',
      amount: { cents: 5790, currency: 'BRL' },
    })
    expect(api.calls[0]?.headers['Authorization']).toBe(`Bearer ${TOKEN}`)
  })

  test('status vira o tipo certo e a chave de idempotência muda com o status', async () => {
    for (const [status, type] of [
      ['pending', 'payment_pending'],
      ['cancelled', 'payment_failed'],
      ['rejected', 'payment_failed'],
      ['refunded', 'payment_refunded'],
      ['charged_back', 'payment_chargeback'],
    ] as const) {
      const api = fakeApi({ 'GET /v1/payments/123456789': { body: { ...APPROVED_PAYMENT, status } } })
      const provider = createMercadoPagoPaymentProvider({
        accessToken: TOKEN,
        webhookSecret: SECRET,
        fetch: api.fetcher,
      })
      const event = await provider.parseWebhook(webhook(NOTIFICATION))
      expect(event.type).toBe(type)
      expect(event.eventId).toBe(`123456789:${status}`)
    }
  })

  test('cartão de crédito no link', async () => {
    const api = fakeApi({
      'GET /v1/payments/123456789': {
        body: { ...APPROVED_PAYMENT, payment_method_id: 'visa', payment_type_id: 'credit_card' },
      },
    })
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    expect((await provider.parseWebhook(webhook(NOTIFICATION))).paymentMethod).toBe('credit_card')
  })

  test('assinatura com segredo errado é recusada sem chamar a API', async () => {
    const api = fakeApi({ 'GET /v1/payments/123456789': { body: APPROVED_PAYMENT } })
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    await expect(provider.parseWebhook(webhook(NOTIFICATION, { secret: 'outro' }))).rejects.toBeInstanceOf(
      PaymentWebhookUnauthorizedError,
    )
    expect(api.calls).toHaveLength(0)
  })

  test('corpo trocado depois de assinado é recusado', async () => {
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fetch: fakeApi({}).fetcher,
    })
    const signed = webhook(NOTIFICATION)
    const tampered = { ...signed, rawBody: JSON.stringify({ ...NOTIFICATION, data: { id: '999' } }) }
    await expect(provider.parseWebhook(tampered)).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError)
  })

  test('sem cabeçalho de assinatura é recusado', async () => {
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fetch: fakeApi({}).fetcher,
    })
    await expect(provider.parseWebhook({ headers: {}, rawBody: JSON.stringify(NOTIFICATION) })).rejects.toBeInstanceOf(
      PaymentWebhookUnauthorizedError,
    )
  })

  test('provedor sem segredo recusa todo webhook', async () => {
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: '',
      fetch: fakeApi({}).fetcher,
    })
    await expect(provider.parseWebhook(webhook(NOTIFICATION))).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError)
  })

  test('corpo que não é JSON', async () => {
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET })
    await expect(provider.parseWebhook({ headers: {}, rawBody: 'oi' })).rejects.toBeInstanceOf(
      PaymentWebhookInvalidError,
    )
  })

  test('tópico que não é pagamento fica no histórico como ignorado', async () => {
    const api = fakeApi({})
    const provider = createMercadoPagoPaymentProvider({ accessToken: TOKEN, webhookSecret: SECRET, fetch: api.fetcher })
    const event = await provider.parseWebhook(
      webhook({ type: 'merchant_order', action: 'merchant_order', data: { id: '55' } }),
    )
    expect(event.type).toBe('ignored')
    expect(api.calls).toHaveLength(0)
  })

  test('notificação de teste do painel (pagamento que não existe) é ignorada', async () => {
    const provider = createMercadoPagoPaymentProvider({
      accessToken: TOKEN,
      webhookSecret: SECRET,
      fetch: fakeApi({}).fetcher,
    })
    const event = await provider.parseWebhook(webhook(NOTIFICATION))
    expect(event.type).toBe('ignored')
  })
})

describe('manifest da assinatura', () => {
  test('id alfanumérico em minúsculas, partes vazias fora', () => {
    expect(buildMercadoPagoManifest({ dataId: 'ABC123', requestId: 'r', ts: '1' })).toBe('id:abc123;request-id:r;ts:1;')
    expect(buildMercadoPagoManifest({ dataId: null, requestId: '', ts: '1' })).toBe('ts:1;')
  })
})
