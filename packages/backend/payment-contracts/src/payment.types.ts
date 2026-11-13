/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O vocabulário do trio de pagamentos. Todo provedor (Hotmart, Stripe, Mercado Pago...) traduz o que
 * manda para estes tipos, e o resto do produto só fala esta língua.
 */

/** Como a pessoa pagou. O provedor traduz o nome dele; o que não se encaixa vira `other`. */
export const PAYMENT_METHOD = {
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  PIX: 'pix',
  BOLETO: 'boleto',
  PAYPAL: 'paypal',
  /** Carteira digital: Google Pay, Apple Pay, saldo do próprio provedor. */
  WALLET: 'wallet',
  OTHER: 'other',
} as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD) as [PaymentMethod, ...PaymentMethod[]]

/** O que aconteceu, na língua do trio. O nome cru do provedor vai junto em `providerEventType`. */
export const PAYMENT_EVENT_TYPE = {
  /** Pagamento aprovado: primeira compra ou renovação. */
  PAYMENT_APPROVED: 'payment_approved',
  /** Boleto/pix gerado, esperando pagar. */
  PAYMENT_PENDING: 'payment_pending',
  /** Cobrança da renovação atrasada. */
  PAYMENT_OVERDUE: 'payment_overdue',
  /** Cobrança cancelada ou expirada sem pagar. */
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REFUNDED: 'payment_refunded',
  PAYMENT_CHARGEBACK: 'payment_chargeback',
  /** Assinatura cancelada: não renova mais. */
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  /** Troca de plano dentro do mesmo produto. */
  SUBSCRIPTION_PLAN_CHANGED: 'subscription_plan_changed',
  /** Evento que não muda assinatura (carrinho abandonado, primeiro acesso...). Fica no histórico. */
  IGNORED: 'ignored',
} as const
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPE)[keyof typeof PAYMENT_EVENT_TYPE]
export const PAYMENT_EVENT_TYPE_VALUES = Object.values(PAYMENT_EVENT_TYPE) as [PaymentEventType, ...PaymentEventType[]]

export const SUBSCRIPTION_STATUS = {
  /** Comprou e o pagamento ainda não caiu (boleto/pix). Sem acesso. */
  PENDING: 'pending',
  ACTIVE: 'active',
  /** Renovação atrasada. Mantém acesso durante a tolerância. */
  PAST_DUE: 'past_due',
  /** Não renova mais. Acesso até o fim do período pago. */
  CANCELED: 'canceled',
  /** Reembolso ou chargeback. Sem acesso. */
  REFUNDED: 'refunded',
} as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]
export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUS) as [
  SubscriptionStatus,
  ...SubscriptionStatus[],
]

export const BILLING_INTERVAL = {
  /** Plano gratuito ou compra avulsa vitalícia. */
  NONE: 'none',
  MONTH: 'month',
  QUARTER: 'quarter',
  SEMESTER: 'semester',
  YEAR: 'year',
} as const
export type BillingInterval = (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL]
export const BILLING_INTERVAL_VALUES = Object.values(BILLING_INTERVAL) as [BillingInterval, ...BillingInterval[]]

export type Money = {
  /** Centavos: inteiro, sem erro de arredondamento na soma. */
  readonly cents: number
  /** ISO 4217 (BRL, USD...). */
  readonly currency: string
}

/** Um evento de pagamento já traduzido. É o que todo `PaymentProviderPort.parseWebhook` devolve. */
export type PaymentEvent = {
  /** Nome do provedor que mandou (`hotmart`, `fake`...). */
  readonly provider: string
  /** Id do evento no provedor: chave de idempotência (o provedor reenvia). */
  readonly eventId: string
  readonly type: PaymentEventType
  /** Nome cru do evento no provedor, para o histórico e para depurar. */
  readonly providerEventType: string
  readonly occurredAt: Date
  /**
   * Id estável da assinatura no provedor. Em compra avulsa é a transação: o trio trata como uma
   * "assinatura" que não vence.
   */
  readonly subscriptionId: string | null
  readonly transactionId: string | null
  /**
   * Só e-mail e nome. Documento, telefone e endereço que o provedor manda ficam no corpo cru, que
   * o trio não guarda (`security.md` §1).
   */
  readonly customer: { readonly email: string | null; readonly name: string | null }
  /** O que o host mandou no link de checkout para achar a pessoa de volta (id do usuário). */
  readonly customerRef: string | null
  /** Oferta/preço no provedor: o módulo traduz para o plano do host. */
  readonly offerCode: string | null
  readonly planName: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly amount: Money | null
  /** Até quando o pagamento cobre, quando o provedor informa. */
  readonly periodEndsAt: Date | null
}

/** O pedaço da assinatura que decide o próximo estado e o acesso. */
export type SubscriptionState = {
  readonly status: SubscriptionStatus
  readonly periodEndsAt: Date | null
  readonly lastEventAt: Date
}

/** Uma oferta de um plano num provedor: é o que liga o webhook ao plano do host. */
export type PlanOffer = {
  readonly provider: string
  /** Código da oferta no provedor (na Hotmart, o `off` do link). */
  readonly offerCode: string
  /** Link de checkout copiado do provedor. Sem ele o plano não é vendável por este provedor. */
  readonly checkoutUrl?: string
  /** Métodos aceitos nesta oferta, para a tela mostrar. Informativo: quem cobra é o provedor. */
  readonly paymentMethods?: readonly PaymentMethod[]
}

/**
 * Plano declarado pelo host. Recurso (`features`) é vocabulário do host: o módulo só responde "este
 * plano libera X?", nunca inventa nomes.
 */
export type PlanDefinition = {
  readonly code: string
  readonly name: string
  readonly description?: string
  readonly interval: BillingInterval
  /** Preço para mostrar. Opcional: o que vale é o que o provedor cobra. */
  readonly price?: Money
  readonly features: readonly string[]
  readonly offers: readonly PlanOffer[]
  /** O plano de quem não paga nada. Exatamente um plano do catálogo tem `isFree`. */
  readonly isFree?: boolean
}

export type Subscription = SubscriptionState & {
  readonly id: string
  readonly companyId: string | null
  readonly customerRef: string | null
  readonly provider: string
  readonly externalId: string
  readonly customerEmail: string | null
  readonly planCode: string
  readonly offerCode: string | null
  readonly paymentMethod: PaymentMethod | null
  readonly canceledAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** O que a pessoa tem agora: o que a tela mostra e o que a rota consulta para liberar recurso. */
export type Entitlement = {
  readonly planCode: string
  readonly planName: string
  readonly status: SubscriptionStatus | 'none'
  readonly hasAccess: boolean
  readonly features: readonly string[]
  readonly periodEndsAt: Date | null
  readonly provider: string | null
  readonly paymentMethod: PaymentMethod | null
}
