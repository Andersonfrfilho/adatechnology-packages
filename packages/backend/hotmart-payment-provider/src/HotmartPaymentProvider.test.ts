/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Corpos no formato do webhook 2.0.0 da Hotmart, escritos à mão: nenhum teste fala com a Hotmart.
 */

import { describe, expect, test } from 'bun:test'

import { PaymentWebhookInvalidError, PaymentWebhookUnauthorizedError } from '@adatechnology/payment-contracts'

import { createHotmartPaymentProvider, HOTMART_HOTTOK_HEADER, readHotmartOfferCode } from './HotmartPaymentProvider'

const HOTTOK = 'hottok-de-teste'
const provider = createHotmartPaymentProvider({ hottok: HOTTOK })

function webhook(body: unknown, hottok: string = HOTTOK) {
  return { headers: { [HOTMART_HOTTOK_HEADER]: hottok }, rawBody: new TextEncoder().encode(JSON.stringify(body)) }
}

const APPROVED = {
  id: 'evt-1',
  creation_date: 1_767_225_600_000,
  event: 'PURCHASE_APPROVED',
  version: '2.0.0',
  data: {
    product: { id: 123, name: 'Premium' },
    buyer: { email: 'Pai@Example.com', name: 'Pai Teste', document: '00000000000' },
    purchase: {
      transaction: 'HP123',
      status: 'APPROVED',
      price: { value: 19.9, currency_value: 'BRL' },
      offer: { code: 'mensal01' },
      origin: { xcod: 'user-1' },
      payment: { type: 'PIX', installments_number: 1 },
      date_next_charge: 1_769_904_000_000,
    },
    subscription: { status: 'ACTIVE', plan: { id: 9, name: 'Mensal' }, subscriber: { code: 'SUB1' } },
  },
}

describe('webhook da Hotmart', () => {
  test('compra aprovada: pessoa, oferta, método, valor e vencimento', async () => {
    const event = await provider.parseWebhook(webhook(APPROVED))
    expect(event).toMatchObject({
      provider: 'hotmart',
      eventId: 'evt-1',
      type: 'payment_approved',
      providerEventType: 'PURCHASE_APPROVED',
      subscriptionId: 'SUB1',
      transactionId: 'HP123',
      customer: { email: 'pai@example.com', name: 'Pai Teste' },
      customerRef: 'user-1',
      offerCode: 'mensal01',
      planName: 'Mensal',
      paymentMethod: 'pix',
      amount: { cents: 1990, currency: 'BRL' },
    })
    expect(event.occurredAt.getTime()).toBe(1_767_225_600_000)
    expect(event.periodEndsAt?.getTime()).toBe(1_769_904_000_000)
  })

  test('o CPF do comprador não sai do provedor', async () => {
    expect(JSON.stringify(await provider.parseWebhook(webhook(APPROVED)))).not.toContain('00000000000')
  })

  test('boleto vira boleto; método desconhecido vira other', async () => {
    const billet = {
      ...APPROVED,
      data: { ...APPROVED.data, purchase: { ...APPROVED.data.purchase, payment: { type: 'BILLET' } } },
    }
    expect((await provider.parseWebhook(webhook(billet))).paymentMethod).toBe('boleto')
    const odd = {
      ...APPROVED,
      data: { ...APPROVED.data, purchase: { ...APPROVED.data.purchase, payment: { type: 'NOVO' } } },
    }
    expect((await provider.parseWebhook(webhook(odd))).paymentMethod).toBe('other')
  })

  test('cancelamento de assinatura usa o assinante do corpo de cancelamento', async () => {
    const event = await provider.parseWebhook(
      webhook({
        id: 'evt-2',
        creation_date: 1_767_225_700_000,
        event: 'SUBSCRIPTION_CANCELLATION',
        data: { subscriber: { code: 'SUB1', email: 'pai@example.com', name: 'Pai' }, plan: { name: 'Mensal' } },
      }),
    )
    expect(event).toMatchObject({
      type: 'subscription_canceled',
      subscriptionId: 'SUB1',
      customer: { email: 'pai@example.com' },
    })
  })

  test('troca de plano pega o plano marcado como atual', async () => {
    const event = await provider.parseWebhook(
      webhook({
        id: 'evt-3',
        event: 'SWITCH_PLAN',
        data: {
          subscription: { subscriber_code: 'SUB1', user: { email: 'pai@example.com' } },
          plans: [
            { name: 'Mensal', current: false, offer: { key: 'mensal01' } },
            { name: 'Anual', current: true, offer: { key: 'anual01' } },
          ],
        },
      }),
    )
    expect(event).toMatchObject({
      type: 'subscription_plan_changed',
      subscriptionId: 'SUB1',
      offerCode: 'anual01',
      planName: 'Anual',
    })
  })

  test('compra avulsa usa a transação como id da assinatura', async () => {
    const data: Record<string, unknown> = { ...APPROVED.data }
    delete data['subscription']
    expect((await provider.parseWebhook(webhook({ ...APPROVED, data }))).subscriptionId).toBe('HP123')
  })

  test('evento que não muda assinatura é aceito como ignorado', async () => {
    expect((await provider.parseWebhook(webhook({ ...APPROVED, event: 'PURCHASE_OUT_OF_SHOPPING_CART' }))).type).toBe(
      'ignored',
    )
  })

  test('hottok errado, ausente ou não configurado é recusado', async () => {
    expect(provider.parseWebhook(webhook(APPROVED, 'outro'))).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError)
    expect(provider.parseWebhook({ headers: {}, rawBody: JSON.stringify(APPROVED) })).rejects.toBeInstanceOf(
      PaymentWebhookUnauthorizedError,
    )
    const empty = createHotmartPaymentProvider({ hottok: '' })
    expect(empty.isConfigured()).toBe(false)
    expect(empty.parseWebhook(webhook(APPROVED, ''))).rejects.toBeInstanceOf(PaymentWebhookUnauthorizedError)
  })

  test('cabeçalho em qualquer caixa', async () => {
    const event = await provider.parseWebhook({
      headers: { 'X-Hotmart-Hottok': HOTTOK },
      rawBody: JSON.stringify(APPROVED),
    })
    expect(event.eventId).toBe('evt-1')
  })

  test('corpo que não é JSON (webhook 1.0) é inválido', async () => {
    expect(
      provider.parseWebhook({ headers: { [HOTMART_HOTTOK_HEADER]: HOTTOK }, rawBody: 'hottok=x&status=approved' }),
    ).rejects.toBeInstanceOf(PaymentWebhookInvalidError)
  })
})

describe('checkout da Hotmart', () => {
  const base = 'https://pay.hotmart.com/X12345678Y?off=mensal01'

  test('o link leva a pessoa em xcod e o e-mail, sem perder a oferta', () => {
    const url = new URL(
      provider.buildCheckoutUrl({ checkoutUrl: base, customerRef: 'user-1', email: 'pai@example.com' }),
    )
    expect(url.searchParams.get('off')).toBe('mensal01')
    expect(url.searchParams.get('xcod')).toBe('user-1')
    expect(url.searchParams.get('email')).toBe('pai@example.com')
  })

  test('lê o código da oferta do link', () => {
    expect(readHotmartOfferCode(base)).toBe('mensal01')
    expect(readHotmartOfferCode('não é link')).toBeNull()
  })
})
