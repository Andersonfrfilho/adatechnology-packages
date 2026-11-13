/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { describe, expect, test } from 'bun:test'

import { PAYMENT_EVENT_TYPE, SUBSCRIPTION_STATUS } from './payment.types'
import {
  applyPaymentEvent,
  DEFAULT_PAST_DUE_GRACE_MS,
  nextSubscriptionStatus,
  subscriptionGrantsAccess,
} from './subscriptionState'

const T0 = new Date('2026-01-01T00:00:00Z')
const T1 = new Date('2026-01-02T00:00:00Z')

describe('estado da assinatura', () => {
  test('aprovado ativa; reembolso e chargeback tiram', () => {
    expect(nextSubscriptionStatus(undefined, PAYMENT_EVENT_TYPE.PAYMENT_APPROVED)).toBe(SUBSCRIPTION_STATUS.ACTIVE)
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED)).toBe(SUBSCRIPTION_STATUS.REFUNDED)
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPE.PAYMENT_CHARGEBACK)).toBe(SUBSCRIPTION_STATUS.REFUNDED)
  })

  test('renovação que falha deixa em atraso; primeira compra que falha cancela', () => {
    expect(nextSubscriptionStatus('active', PAYMENT_EVENT_TYPE.PAYMENT_FAILED)).toBe(SUBSCRIPTION_STATUS.PAST_DUE)
    expect(nextSubscriptionStatus('pending', PAYMENT_EVENT_TYPE.PAYMENT_FAILED)).toBe(SUBSCRIPTION_STATUS.CANCELED)
  })

  test('cancelamento depois de reembolso continua reembolsado', () => {
    expect(nextSubscriptionStatus('refunded', PAYMENT_EVENT_TYPE.SUBSCRIPTION_CANCELED)).toBe(
      SUBSCRIPTION_STATUS.REFUNDED,
    )
  })

  test('evento ignorado sem assinatura não cria nada', () => {
    expect(
      applyPaymentEvent(undefined, { type: PAYMENT_EVENT_TYPE.IGNORED, occurredAt: T0, periodEndsAt: null }),
    ).toBeUndefined()
  })

  test('evento atrasado não desfaz o mais novo', () => {
    const refunded = { status: SUBSCRIPTION_STATUS.REFUNDED, periodEndsAt: null, lastEventAt: T1 }
    expect(
      applyPaymentEvent(refunded, { type: PAYMENT_EVENT_TYPE.PAYMENT_APPROVED, occurredAt: T0, periodEndsAt: null }),
    ).toBe(refunded)
  })

  test('o vencimento fica quando o evento novo não informa', () => {
    const active = { status: SUBSCRIPTION_STATUS.ACTIVE, periodEndsAt: T1, lastEventAt: T0 }
    expect(
      applyPaymentEvent(active, { type: PAYMENT_EVENT_TYPE.SUBSCRIPTION_CANCELED, occurredAt: T1, periodEndsAt: null }),
    ).toEqual({
      status: SUBSCRIPTION_STATUS.CANCELED,
      periodEndsAt: T1,
      lastEventAt: T1,
    })
  })
})

describe('acesso', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const past = new Date('2026-01-05T00:00:00Z')
  const future = new Date('2026-01-20T00:00:00Z')

  test('ativo usa; pendente e reembolsado não', () => {
    expect(subscriptionGrantsAccess({ status: 'active', periodEndsAt: null }, { now })).toBe(true)
    expect(subscriptionGrantsAccess({ status: 'pending', periodEndsAt: future }, { now })).toBe(false)
    expect(subscriptionGrantsAccess({ status: 'refunded', periodEndsAt: future }, { now })).toBe(false)
  })

  test('cancelado usa até o fim do período pago', () => {
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: future }, { now })).toBe(true)
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: past }, { now })).toBe(false)
    expect(subscriptionGrantsAccess({ status: 'canceled', periodEndsAt: null }, { now })).toBe(false)
  })

  test('atrasado usa durante a tolerância, que o host pode mudar', () => {
    const justExpired = new Date(now.getTime() - DEFAULT_PAST_DUE_GRACE_MS + 60_000)
    expect(subscriptionGrantsAccess({ status: 'past_due', periodEndsAt: justExpired }, { now })).toBe(true)
    expect(
      subscriptionGrantsAccess({ status: 'past_due', periodEndsAt: justExpired }, { now, pastDueGraceMs: 0 }),
    ).toBe(false)
  })
})
