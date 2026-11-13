/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As portas. `PaymentProviderPort` é o plugin: cada provedor é um pacote que só depende destes
 * contracts (`@adatechnology/hotmart-payment-provider`, e os próximos). O módulo recebe uma lista
 * deles e não conhece nenhum pelo nome.
 */

import type { PaymentEvent, PaymentMethod, Subscription, SubscriptionStatus } from './payment.types'

/** O webhook como chegou. Bytes crus: assinatura HMAC é calculada sobre eles, não sobre o JSON. */
export type IncomingWebhook = {
  readonly headers: Readonly<Record<string, string>>
  readonly rawBody: Uint8Array | string
}

export type CheckoutLinkParams = {
  /** Link de checkout da oferta, como o provedor gera. */
  readonly checkoutUrl: string
  /** Id da pessoa no host. Volta no webhook em `PaymentEvent.customerRef`. */
  readonly customerRef: string
  readonly email?: string
  readonly name?: string
}

export interface PaymentProviderPort {
  /** Nome estável: vai para o banco e para a rota do webhook (`/payments/webhooks/:provider`). */
  readonly name: string
  /** Métodos que o provedor sabe cobrar. Informativo, para a tela. */
  readonly paymentMethods: readonly PaymentMethod[]
  /** Falso quando falta credencial: o webhook responde 503 em vez de aceitar qualquer um. */
  isConfigured(): boolean
  /**
   * Confere que o webhook veio mesmo do provedor e traduz. Lança `PaymentWebhookUnauthorizedError`
   * (credencial errada) ou `PaymentWebhookInvalidError` (corpo que não dá para ler).
   */
  parseWebhook(webhook: IncomingWebhook): Promise<PaymentEvent>
  /** Link de checkout com a pessoa marcada, para o webhook achar quem pagou. */
  buildCheckoutUrl(params: CheckoutLinkParams): string
  /**
   * Opcional: cancela a assinatura pela API do provedor. Capacidade por ausência — sem ela, a rota de
   * cancelamento não é publicada e a pessoa cancela no próprio provedor.
   */
  cancelSubscription?(params: { readonly subscriptionId: string }): Promise<void>
}

/**
 * Quem é a pessoa, para o host que tem cadastro próprio. O módulo não lê a tabela de usuários do host
 * (`pluggable-module.md`): pergunta por esta porta.
 */
export interface CustomerResolverPort {
  /** O `customerRef` que o checkout levou existe? Devolve o mesmo id normalizado, ou `undefined`. */
  findByRef(params: { readonly ref: string; readonly companyId?: string }): Promise<string | undefined>
  /** Plano B: o e-mail da compra pertence a alguém? */
  findByEmail(params: { readonly email: string; readonly companyId?: string }): Promise<string | undefined>
  /**
   * Opcional: o e-mail da pessoa logada. Com ele, a compra feita antes de ter conta (ou fora do app)
   * é amarrada a ela quando entra. Só ligue se o host CONFIRMA o e-mail no cadastro: sem
   * confirmação, quem criar conta com o e-mail de outro comprador fica com a assinatura dele.
   */
  findEmailByRef?(params: { readonly ref: string; readonly companyId?: string }): Promise<string | undefined>
}

export type ClockPort = { now(): Date }

export type LogMeta = Readonly<Record<string, unknown>>

export type LoggerPort = {
  info(event: string, meta?: LogMeta): void
  warn(event: string, meta?: LogMeta): void
  error(event: string, meta?: LogMeta): void
}

/** Ganchos opcionais: o host reage a mudança de assinatura (e-mail de boas-vindas, push, métrica). */
export type PaymentHooks = {
  onSubscriptionChanged?(params: {
    readonly subscription: Subscription
    readonly event: PaymentEvent
    readonly previousStatus: SubscriptionStatus | undefined
  }): Promise<void> | void
}
