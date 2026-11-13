/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Plugin Hotmart do trio de pagamentos. Sem estado e sem I/O: recebe o webhook versão 2.0.0 (JSON) e
 * monta o link de checkout.
 *
 * - Autenticidade: a Hotmart manda o "hottok" da conta no cabeçalho `X-HOTMART-HOTTOK`. Diferente do
 *   configurado, o webhook é recusado (comparação em tempo constante).
 * - Pessoa: o link de checkout leva `xcod=<customerRef>`, e a Hotmart devolve em
 *   `data.purchase.origin.xcod`. O e-mail do comprador é o plano B, decidido no módulo.
 * - Privacidade: só e-mail e nome saem daqui. CPF, telefone e endereço do comprador ficam no corpo
 *   cru, que ninguém guarda.
 */

import { timingSafeEqual } from 'node:crypto'

import {
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  PaymentWebhookInvalidError,
  PaymentWebhookUnauthorizedError,
} from '@adatechnology/payment-contracts'
import type {
  CheckoutLinkParams,
  IncomingWebhook,
  Money,
  PaymentEvent,
  PaymentEventType,
  PaymentMethod,
  PaymentProviderPort,
} from '@adatechnology/payment-contracts'

export const HOTMART_PROVIDER_NAME = 'hotmart'
export const HOTMART_HOTTOK_HEADER = 'x-hotmart-hottok'

/** Evento da Hotmart → evento do trio. O que não está aqui vira `ignored` (fica só no histórico). */
export const HOTMART_EVENT_MAP: Readonly<Record<string, PaymentEventType>> = {
  PURCHASE_APPROVED: PAYMENT_EVENT_TYPE.PAYMENT_APPROVED,
  PURCHASE_COMPLETE: PAYMENT_EVENT_TYPE.PAYMENT_APPROVED,
  PURCHASE_BILLET_PRINTED: PAYMENT_EVENT_TYPE.PAYMENT_PENDING,
  PURCHASE_DELAYED: PAYMENT_EVENT_TYPE.PAYMENT_OVERDUE,
  PURCHASE_PROTEST: PAYMENT_EVENT_TYPE.PAYMENT_OVERDUE,
  PURCHASE_CANCELED: PAYMENT_EVENT_TYPE.PAYMENT_FAILED,
  PURCHASE_EXPIRED: PAYMENT_EVENT_TYPE.PAYMENT_FAILED,
  PURCHASE_REFUNDED: PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED,
  PURCHASE_CHARGEBACK: PAYMENT_EVENT_TYPE.PAYMENT_CHARGEBACK,
  SUBSCRIPTION_CANCELLATION: PAYMENT_EVENT_TYPE.SUBSCRIPTION_CANCELED,
  SWITCH_PLAN: PAYMENT_EVENT_TYPE.SUBSCRIPTION_PLAN_CHANGED,
}

/** `data.purchase.payment.type` da Hotmart → método do trio. */
export const HOTMART_PAYMENT_METHOD_MAP: Readonly<Record<string, PaymentMethod>> = {
  CREDIT_CARD: PAYMENT_METHOD.CREDIT_CARD,
  DEBIT_CARD: PAYMENT_METHOD.DEBIT_CARD,
  PIX: PAYMENT_METHOD.PIX,
  BILLET: PAYMENT_METHOD.BOLETO,
  PAYPAL: PAYMENT_METHOD.PAYPAL,
  PAYPAL_INTERNACIONAL: PAYMENT_METHOD.PAYPAL,
  GOOGLE_PAY: PAYMENT_METHOD.WALLET,
  APPLE_PAY: PAYMENT_METHOD.WALLET,
  HOTCARD: PAYMENT_METHOD.WALLET,
  WALLET: PAYMENT_METHOD.WALLET,
}

export type HotmartProviderConfig = {
  /** O "hottok" da conta (Ferramentas → Webhook na Hotmart). Vazio desliga o provedor. */
  readonly hottok: string
}

type Json = Record<string, unknown>

function asObject(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined
}

/** Lê `a.b.c` sem estourar no meio: o formato muda entre eventos da Hotmart. */
function pick(source: unknown, path: string): unknown {
  let current: unknown = source
  for (const key of path.split('.')) {
    const object = asObject(current)
    if (!object) return undefined
    current = object[key]
  }
  return current
}

function text(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

/** A Hotmart manda data em milissegundos (número) e, às vezes, texto. */
function date(...values: unknown[]): Date | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return new Date(value)
    if (typeof value === 'string' && value.length > 0) {
      const parsed = /^\d+$/.test(value) ? new Date(Number(value)) : new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return null
}

function amount(data: unknown): Money | null {
  const price = asObject(pick(data, 'purchase.price')) ?? asObject(pick(data, 'purchase.full_price'))
  const value = price?.['value']
  const currency = text(price?.['currency_value'], price?.['currency_code'])
  if (typeof value !== 'number' || !Number.isFinite(value) || !currency) return null
  return { cents: Math.round(value * 100), currency: currency.toUpperCase() }
}

function paymentMethod(data: unknown): PaymentMethod | null {
  const raw = text(pick(data, 'purchase.payment.type'))
  if (!raw) return null
  return HOTMART_PAYMENT_METHOD_MAP[raw.toUpperCase()] ?? PAYMENT_METHOD.OTHER
}

/** No `SWITCH_PLAN` a Hotmart manda a lista de planos e marca o atual. */
function currentPlan(data: unknown): Json | undefined {
  const plans = pick(data, 'plans')
  if (!Array.isArray(plans)) return undefined
  return plans.map(asObject).find((plan) => plan?.['current'] === true)
}

function header(headers: IncomingWebhook['headers'], name: string): string {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name)
  return found?.[1] ?? ''
}

function sameSecret(received: string, expected: string): boolean {
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function decode(rawBody: IncomingWebhook['rawBody']): string {
  return typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody)
}

export function createHotmartPaymentProvider(config: HotmartProviderConfig): PaymentProviderPort {
  const hottok = config.hottok.trim()

  return {
    name: HOTMART_PROVIDER_NAME,
    paymentMethods: [
      PAYMENT_METHOD.CREDIT_CARD,
      PAYMENT_METHOD.PIX,
      PAYMENT_METHOD.BOLETO,
      PAYMENT_METHOD.PAYPAL,
      PAYMENT_METHOD.WALLET,
    ],
    isConfigured: () => hottok.length > 0,

    async parseWebhook({ headers, rawBody }): Promise<PaymentEvent> {
      if (hottok.length === 0 || !sameSecret(header(headers, HOTMART_HOTTOK_HEADER), hottok)) {
        throw new PaymentWebhookUnauthorizedError(HOTMART_PROVIDER_NAME)
      }
      let payload: unknown
      try {
        payload = JSON.parse(decode(rawBody))
      } catch {
        throw new PaymentWebhookInvalidError(HOTMART_PROVIDER_NAME, 'corpo não é JSON (use o webhook versão 2.0.0)')
      }
      const eventName = text(pick(payload, 'event'))
      const eventId = text(pick(payload, 'id'))
      const data = pick(payload, 'data')
      if (!eventName || !eventId || !asObject(data)) {
        throw new PaymentWebhookInvalidError(HOTMART_PROVIDER_NAME, 'faltam id, event ou data')
      }
      const plan = currentPlan(data)
      const transactionId = text(pick(data, 'purchase.transaction'))
      return {
        provider: HOTMART_PROVIDER_NAME,
        eventId,
        type: HOTMART_EVENT_MAP[eventName] ?? PAYMENT_EVENT_TYPE.IGNORED,
        providerEventType: eventName,
        occurredAt: date(pick(payload, 'creation_date')) ?? new Date(),
        subscriptionId:
          text(
            pick(data, 'subscription.subscriber.code'),
            pick(data, 'subscriber.code'),
            pick(data, 'subscription.subscriber_code'),
          ) ?? transactionId,
        transactionId,
        customer: {
          email:
            text(
              pick(data, 'buyer.email'),
              pick(data, 'subscriber.email'),
              pick(data, 'subscription.user.email'),
            )?.toLowerCase() ?? null,
          name: text(pick(data, 'buyer.name'), pick(data, 'subscriber.name'), pick(data, 'subscription.user.name')),
        },
        customerRef: text(pick(data, 'purchase.origin.xcod')),
        offerCode: text(pick(data, 'purchase.offer.code'), pick(plan, 'offer.key'), pick(plan, 'offer.code')),
        planName: text(pick(data, 'subscription.plan.name'), pick(data, 'plan.name'), pick(plan, 'name')),
        paymentMethod: paymentMethod(data),
        amount: amount(data),
        periodEndsAt: date(pick(data, 'purchase.date_next_charge'), pick(data, 'subscription.date_next_charge')),
      }
    },

    buildCheckoutUrl({ checkoutUrl, customerRef, email, name }: CheckoutLinkParams): string {
      const url = new URL(checkoutUrl)
      url.searchParams.set('xcod', customerRef)
      if (email) url.searchParams.set('email', email)
      if (name) url.searchParams.set('name', name)
      return url.toString()
    },
  }
}

/** O código da oferta (`off`) dentro de um link de checkout da Hotmart. */
export function readHotmartOfferCode(checkoutUrl: string): string | null {
  try {
    return new URL(checkoutUrl).searchParams.get('off')
  } catch {
    return null
  }
}
