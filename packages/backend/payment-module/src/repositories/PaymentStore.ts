/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que o módulo precisa do banco, como porta. Duas implementações: `DrizzlePaymentStore` (a de
 * verdade) e `createInMemoryPaymentStore` (em `./testing`, para o host testar sem Postgres).
 */

import type {
  ListPaymentEventsQuery,
  ListSubscriptionsQuery,
  PaymentEvent,
  PaymentMethod,
  Subscription,
  SubscriptionState,
} from '@adatechnology/payment-contracts'

/** O que o módulo decide para a assinatura, a partir do estado atual. */
export type SubscriptionDecision = {
  readonly state: SubscriptionState
  readonly planCode: string
}

export type ApplyEventResult =
  | { readonly outcome: 'duplicate' }
  | {
      readonly outcome: 'recorded'
      readonly previous: Subscription | undefined
      readonly subscription: Subscription | undefined
    }

export type StoredPaymentEvent = {
  readonly id: string
  readonly provider: string
  readonly type: string
  readonly providerEventType: string
  readonly occurredAt: Date
  readonly customerRef: string | null
  readonly customerEmail: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly amountCents: number | null
  readonly currency: string | null
}

export type PaymentOverview = {
  readonly byStatus: Readonly<Record<string, number>>
  /** Assinaturas que liberam acesso agora, por plano. */
  readonly withAccessByPlan: readonly { readonly planCode: string; readonly count: number }[]
  /** Pagamentos aprovados nos últimos 30 dias, por moeda. */
  readonly revenue30d: readonly { readonly currency: string; readonly cents: number; readonly payments: number }[]
  /** Pagamentos aprovados nos últimos 30 dias, por método. */
  readonly methods30d: readonly { readonly paymentMethod: string; readonly payments: number }[]
  /** Pagaram com e-mail que ainda não tem conta no host. */
  readonly unlinked: number
}

export type Page<T> = { readonly rows: readonly T[]; readonly total: number }

export interface PaymentStore {
  /**
   * Numa transação: grava o evento (ou devolve `duplicate`), trava a assinatura, pede a `decide` o
   * próximo estado e grava. `decide` devolvendo `undefined` deixa a assinatura como está.
   */
  applyEvent(params: {
    readonly companyId: string | null
    readonly event: PaymentEvent
    readonly customerRef: string | null
    readonly decide: (current: Subscription | undefined) => SubscriptionDecision | undefined
  }): Promise<ApplyEventResult>
  /** As assinaturas da pessoa, mais recente primeiro. */
  listByCustomer(params: {
    readonly companyId: string | null
    readonly customerRef: string
  }): Promise<readonly Subscription[]>
  /** Amarra à pessoa as assinaturas sem dono pagas com o e-mail dela. Devolve quantas. */
  claimByEmail(params: {
    readonly companyId: string | null
    readonly customerRef: string
    readonly email: string
  }): Promise<number>
  /**
   * Amarra à pessoa a assinatura sem dono de uma transação do provedor. Devolve a assinatura quando
   * ela é (ou já era) da pessoa; `undefined` quando não existe ou é de outra pessoa.
   */
  claimByTransaction(params: {
    readonly companyId: string | null
    readonly customerRef: string
    readonly provider: string
    readonly transactionId: string
  }): Promise<Subscription | undefined>
  /** Marca como cancelada a pedido (o provedor confirma depois pelo webhook). */
  markCanceled(params: { readonly id: string; readonly at: Date }): Promise<void>
  overview(params: {
    readonly companyId: string | null
    readonly now: Date
    readonly pastDueGraceMs: number
  }): Promise<PaymentOverview>
  listSubscriptions(params: { readonly companyId: string | null } & ListSubscriptionsQuery): Promise<Page<Subscription>>
  listEvents(params: { readonly companyId: string | null } & ListPaymentEventsQuery): Promise<Page<StoredPaymentEvent>>
}
