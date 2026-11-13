/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Para o host testar sem Postgres e sem provedor de verdade (nenhum teste chama serviço externo).
 * `createInMemoryPaymentStore` segue as mesmas regras do `DrizzlePaymentStore`; o teste de
 * integração do pacote roda os dois contra os mesmos cenários.
 */

import { randomUUID, timingSafeEqual } from 'node:crypto'

import {
  PAYMENT_EVENT_TYPE,
  PAYMENT_EVENT_TYPE_VALUES,
  PAYMENT_METHOD,
  PaymentWebhookInvalidError,
  PaymentWebhookUnauthorizedError,
  SUBSCRIPTION_STATUS,
  subscriptionGrantsAccess,
} from '@adatechnology/payment-contracts'
import type {
  PaymentEvent,
  PaymentEventType,
  PaymentMethod,
  PaymentProviderPort,
  Subscription,
} from '@adatechnology/payment-contracts'

import type { PaymentStore, StoredPaymentEvent } from '../repositories/PaymentStore'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

type StoredEvent = Omit<StoredPaymentEvent, 'customerRef'> & {
  transactionId: string | null
  customerRef: string | null
  companyId: string | null
  externalId: string
  subscriptionId: string | null
}

export function createInMemoryPaymentStore(): PaymentStore & {
  readonly subscriptions: Subscription[]
  readonly events: StoredEvent[]
} {
  const subscriptions: Subscription[] = []
  const events: StoredEvent[] = []
  const sameCompany = (row: { companyId: string | null }, companyId: string | null) => row.companyId === companyId
  const byRecent = (a: Subscription, b: Subscription) => b.lastEventAt.getTime() - a.lastEventAt.getTime()

  return {
    subscriptions,
    events,

    async applyEvent({ companyId, event, customerRef, decide }) {
      if (events.some((row) => row.provider === event.provider && row.externalId === event.eventId)) {
        return { outcome: 'duplicate' }
      }
      const stored: StoredEvent = {
        id: randomUUID(),
        companyId,
        externalId: event.eventId,
        subscriptionId: null,
        transactionId: event.transactionId,
        provider: event.provider,
        type: event.type,
        providerEventType: event.providerEventType,
        occurredAt: event.occurredAt,
        customerRef,
        customerEmail: event.customer.email,
        paymentMethod: event.paymentMethod,
        amountCents: event.amount?.cents ?? null,
        currency: event.amount?.currency ?? null,
      }
      events.push(stored)
      if (!event.subscriptionId) return { outcome: 'recorded', previous: undefined, subscription: undefined }
      const index = subscriptions.findIndex(
        (row) => row.provider === event.provider && row.externalId === event.subscriptionId,
      )
      const current = index >= 0 ? subscriptions[index] : undefined
      const decision = decide(current)
      if (!decision) {
        if (current) stored.subscriptionId = current.id
        return { outcome: 'recorded', previous: current, subscription: current }
      }
      const { status } = decision.state
      const now = new Date()
      const saved: Subscription = {
        id: current?.id ?? randomUUID(),
        companyId: current?.companyId ?? companyId,
        customerRef: customerRef ?? current?.customerRef ?? null,
        provider: event.provider,
        externalId: event.subscriptionId,
        customerEmail: event.customer.email ?? current?.customerEmail ?? null,
        planCode: decision.planCode,
        offerCode: event.offerCode ?? current?.offerCode ?? null,
        paymentMethod: event.paymentMethod ?? current?.paymentMethod ?? null,
        ...decision.state,
        canceledAt:
          status === SUBSCRIPTION_STATUS.CANCELED
            ? (current?.canceledAt ?? event.occurredAt)
            : status === SUBSCRIPTION_STATUS.ACTIVE
              ? null
              : (current?.canceledAt ?? null),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      }
      if (current) subscriptions[index] = saved
      else subscriptions.push(saved)
      stored.subscriptionId = saved.id
      stored.customerRef = saved.customerRef
      return { outcome: 'recorded', previous: current, subscription: saved }
    },

    async listByCustomer({ companyId, customerRef }) {
      return subscriptions
        .filter((row) => sameCompany(row, companyId) && row.customerRef === customerRef)
        .sort(byRecent)
    },

    async claimByEmail({ companyId, customerRef, email }) {
      let claimed = 0
      subscriptions.forEach((row, index) => {
        if (
          sameCompany(row, companyId) &&
          row.customerRef === null &&
          row.customerEmail?.toLowerCase() === email.toLowerCase()
        ) {
          subscriptions[index] = { ...row, customerRef, updatedAt: new Date() }
          claimed += 1
        }
      })
      return claimed
    },

    async claimByTransaction({ companyId, customerRef, provider, transactionId }) {
      const event = events.find(
        (row) =>
          sameCompany(row, companyId) &&
          row.provider === provider &&
          row.transactionId === transactionId &&
          row.subscriptionId !== null,
      )
      const index = subscriptions.findIndex((row) => row.id === event?.subscriptionId)
      const current = subscriptions[index]
      if (!current) return undefined
      if (current.customerRef === null) {
        const claimed = { ...current, customerRef, updatedAt: new Date() }
        subscriptions[index] = claimed
        for (const row of events)
          if (row.subscriptionId === claimed.id && row.customerRef === null) row.customerRef = customerRef
        return claimed
      }
      return current.customerRef === customerRef ? current : undefined
    },

    async markCanceled({ id, at }) {
      const index = subscriptions.findIndex((row) => row.id === id)
      const row = subscriptions[index]
      if (row) subscriptions[index] = { ...row, status: SUBSCRIPTION_STATUS.CANCELED, canceledAt: at, updatedAt: at }
    },

    async overview({ companyId, now, pastDueGraceMs }) {
      const mine = subscriptions.filter((row) => sameCompany(row, companyId))
      const byStatus: Record<string, number> = {}
      const byPlan = new Map<string, number>()
      for (const row of mine) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
        if (subscriptionGrantsAccess(row, { now, pastDueGraceMs }))
          byPlan.set(row.planCode, (byPlan.get(row.planCode) ?? 0) + 1)
      }
      const since = now.getTime() - THIRTY_DAYS_MS
      const approved = events.filter(
        (row) =>
          sameCompany(row, companyId) &&
          row.type === PAYMENT_EVENT_TYPE.PAYMENT_APPROVED &&
          row.occurredAt.getTime() >= since,
      )
      const revenue = new Map<string, { cents: number; payments: number }>()
      const methods = new Map<string, number>()
      for (const row of approved) {
        if (row.currency) {
          const entry = revenue.get(row.currency) ?? { cents: 0, payments: 0 }
          revenue.set(row.currency, { cents: entry.cents + (row.amountCents ?? 0), payments: entry.payments + 1 })
        }
        const method = row.paymentMethod ?? PAYMENT_METHOD.OTHER
        methods.set(method, (methods.get(method) ?? 0) + 1)
      }
      return {
        byStatus,
        withAccessByPlan: [...byPlan]
          .map(([planCode, count]) => ({ planCode, count }))
          .sort((a, b) => b.count - a.count),
        revenue30d: [...revenue].map(([currency, entry]) => ({ currency, ...entry })),
        methods30d: [...methods].map(([paymentMethod, payments]) => ({ paymentMethod, payments })),
        unlinked: mine.filter((row) => row.customerRef === null).length,
      }
    },

    async listSubscriptions({ companyId, page, perPage, status, search }) {
      const needle = search?.toLowerCase()
      const rows = subscriptions
        .filter((row) => sameCompany(row, companyId))
        .filter((row) => !status || row.status === status)
        .filter((row) => !needle || (row.customerEmail ?? '').toLowerCase().includes(needle))
        .sort(byRecent)
      return { rows: rows.slice((page - 1) * perPage, page * perPage), total: rows.length }
    },

    async listEvents({ companyId, page, perPage }) {
      const rows = events
        .filter((row) => sameCompany(row, companyId))
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .map((row): StoredPaymentEvent => ({
          id: row.id,
          provider: row.provider,
          type: row.type,
          providerEventType: row.providerEventType,
          occurredAt: row.occurredAt,
          customerRef: row.customerRef,
          customerEmail: row.customerEmail,
          paymentMethod: row.paymentMethod,
          amountCents: row.amountCents,
          currency: row.currency,
        }))
      return { rows: rows.slice((page - 1) * perPage, page * perPage), total: rows.length }
    },
  }
}

export const FAKE_PAYMENT_PROVIDER_NAME = 'fake'
export const FAKE_PAYMENT_SECRET_HEADER = 'x-fake-payment-secret'

/** O corpo que o provedor falso aceita: o próprio `PaymentEvent`, com datas em ISO. */
export type FakePaymentWebhookBody = {
  readonly eventId: string
  readonly type: PaymentEventType
  readonly occurredAt: string
  readonly subscriptionId?: string | null
  /** Código da compra, como o que chega no e-mail de confirmação. */
  readonly transactionId?: string | null
  readonly customerRef?: string | null
  readonly email?: string | null
  readonly name?: string | null
  readonly offerCode?: string | null
  readonly paymentMethod?: PaymentMethod | null
  readonly amountCents?: number | null
  readonly currency?: string | null
  readonly periodEndsAt?: string | null
}

/**
 * Provedor de mentira, para dev e teste: confere um segredo no header e aceita o evento já traduzido.
 * `cancels: true` liga o cancelamento pela API (para testar a rota de cancelar).
 */
export function createFakePaymentProvider(params: {
  readonly secret: string | undefined
  readonly name?: string
  readonly cancels?: boolean
  readonly onCancel?: (subscriptionId: string) => void
}): PaymentProviderPort {
  const name = params.name ?? FAKE_PAYMENT_PROVIDER_NAME
  const expected = params.secret ? Buffer.from(params.secret) : undefined
  return {
    name,
    paymentMethods: [PAYMENT_METHOD.CREDIT_CARD, PAYMENT_METHOD.PIX],
    isConfigured: () => expected !== undefined,
    async parseWebhook({ headers, rawBody }): Promise<PaymentEvent> {
      const sent = Object.entries(headers).find(([key]) => key.toLowerCase() === FAKE_PAYMENT_SECRET_HEADER)?.[1]
      const given = Buffer.from(sent ?? '')
      if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new PaymentWebhookUnauthorizedError(name)
      }
      let body: FakePaymentWebhookBody
      try {
        body = JSON.parse(typeof rawBody === 'string' ? rawBody : new TextDecoder().decode(rawBody))
      } catch {
        throw new PaymentWebhookInvalidError(name, 'JSON inválido')
      }
      if (
        !body?.eventId ||
        !PAYMENT_EVENT_TYPE_VALUES.includes(body.type) ||
        Number.isNaN(Date.parse(body.occurredAt))
      ) {
        throw new PaymentWebhookInvalidError(name, 'faltam eventId, type ou occurredAt')
      }
      return {
        provider: name,
        eventId: body.eventId,
        type: body.type,
        providerEventType: body.type,
        occurredAt: new Date(body.occurredAt),
        subscriptionId: body.subscriptionId ?? null,
        transactionId: body.transactionId ?? null,
        customer: { email: body.email ?? null, name: body.name ?? null },
        customerRef: body.customerRef ?? null,
        offerCode: body.offerCode ?? null,
        planName: null,
        paymentMethod: body.paymentMethod ?? null,
        amount: body.amountCents != null && body.currency ? { cents: body.amountCents, currency: body.currency } : null,
        periodEndsAt: body.periodEndsAt ? new Date(body.periodEndsAt) : null,
      }
    },
    buildCheckoutUrl({ checkoutUrl, customerRef }) {
      const url = new URL(checkoutUrl)
      url.searchParams.set('ref', customerRef)
      return url.toString()
    },
    ...(params.cancels
      ? {
          async cancelSubscription({ subscriptionId }: { readonly subscriptionId: string }) {
            params.onCancel?.(subscriptionId)
          },
        }
      : {}),
  }
}
