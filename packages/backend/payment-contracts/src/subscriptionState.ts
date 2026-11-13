/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * A máquina de estados da assinatura. Pura e sem I/O: o mesmo evento sobre o mesmo estado dá sempre o
 * mesmo resultado, seja qual for o provedor. Fica nos contracts porque o host também precisa dela
 * (para decidir acesso sem passar pelo módulo, num worker, num teste).
 */

import { PAYMENT_EVENT_TYPE, SUBSCRIPTION_STATUS } from './payment.types'
import type { PaymentEvent, PaymentEventType, SubscriptionState, SubscriptionStatus } from './payment.types'

/** Tolerância padrão do atraso de renovação, contada do fim do período pago. */
export const DEFAULT_PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export function nextSubscriptionStatus(
  current: SubscriptionStatus | undefined,
  type: PaymentEventType,
): SubscriptionStatus | undefined {
  switch (type) {
    case PAYMENT_EVENT_TYPE.PAYMENT_APPROVED:
      return SUBSCRIPTION_STATUS.ACTIVE
    case PAYMENT_EVENT_TYPE.PAYMENT_PENDING:
      return current ?? SUBSCRIPTION_STATUS.PENDING
    case PAYMENT_EVENT_TYPE.PAYMENT_OVERDUE:
      return SUBSCRIPTION_STATUS.PAST_DUE
    case PAYMENT_EVENT_TYPE.PAYMENT_FAILED:
      // Renovação que não passou fica atrasada; o provedor avisa o cancelamento à parte.
      return current === SUBSCRIPTION_STATUS.ACTIVE || current === SUBSCRIPTION_STATUS.PAST_DUE
        ? SUBSCRIPTION_STATUS.PAST_DUE
        : SUBSCRIPTION_STATUS.CANCELED
    case PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED:
    case PAYMENT_EVENT_TYPE.PAYMENT_CHARGEBACK:
      return SUBSCRIPTION_STATUS.REFUNDED
    case PAYMENT_EVENT_TYPE.SUBSCRIPTION_CANCELED:
      return current === SUBSCRIPTION_STATUS.REFUNDED ? current : SUBSCRIPTION_STATUS.CANCELED
    case PAYMENT_EVENT_TYPE.SUBSCRIPTION_PLAN_CHANGED:
      return current ?? SUBSCRIPTION_STATUS.ACTIVE
    case PAYMENT_EVENT_TYPE.IGNORED:
      return current
  }
}

/**
 * Aplica o evento. Evento mais velho que o último aplicado não muda nada: o provedor reenvia e entrega
 * fora de ordem, e um "aprovado" atrasado não pode desfazer um reembolso que já chegou.
 */
export function applyPaymentEvent(
  current: SubscriptionState | undefined,
  event: Pick<PaymentEvent, 'type' | 'occurredAt' | 'periodEndsAt'>,
): SubscriptionState | undefined {
  if (current && event.occurredAt < current.lastEventAt) return current
  const status = nextSubscriptionStatus(current?.status, event.type)
  if (status === undefined) return undefined
  return {
    status,
    periodEndsAt: event.periodEndsAt ?? current?.periodEndsAt ?? null,
    lastEventAt: event.occurredAt,
  }
}

/** Se a assinatura libera o que o plano promete, agora. */
export function subscriptionGrantsAccess(
  state: Pick<SubscriptionState, 'status' | 'periodEndsAt'>,
  options: { readonly now?: Date; readonly pastDueGraceMs?: number } = {},
): boolean {
  const now = options.now ?? new Date()
  const grace = options.pastDueGraceMs ?? DEFAULT_PAST_DUE_GRACE_MS
  switch (state.status) {
    case SUBSCRIPTION_STATUS.ACTIVE:
      return true
    case SUBSCRIPTION_STATUS.PAST_DUE:
      return state.periodEndsAt === null || now.getTime() < state.periodEndsAt.getTime() + grace
    case SUBSCRIPTION_STATUS.CANCELED:
      return state.periodEndsAt !== null && now < state.periodEndsAt
    case SUBSCRIPTION_STATUS.PENDING:
    case SUBSCRIPTION_STATUS.REFUNDED:
      return false
  }
}
