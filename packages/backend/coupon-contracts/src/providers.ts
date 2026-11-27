/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Portas e configuração. Tudo opcional, capacidade por ausência: sem `leadNotifier` o código não vai
 * por e-mail; sem `customerIdentity` o lead fica sem cliente; sem `rateLimiter` as rotas públicas
 * nem sobem (ver `createCouponRoutes`).
 */

import type { Campaign, Lead, PublicCampaign, Redemption } from './coupon.types'

export interface ClockPort {
  now(): Date
}

export type LogMeta = Readonly<Record<string, unknown>>

/** Nunca recebe telefone, e-mail, nome ou código pessoal: só ids opacos e contagens. */
export interface LoggerPort {
  debug(message: string, meta?: LogMeta): void
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void
}

export type LeadContact = {
  readonly name: string | null
  readonly phone: string | null
  readonly email: string | null
}

/**
 * Entrega o código à pessoa (e-mail, WhatsApp…). O host pluga o `notification-module` aqui, com o
 * modelo de mensagem dele. Chamado depois de gravar; erro é logado e não desfaz o cadastro.
 */
export interface LeadNotifierPort {
  sendCoupon(params: {
    readonly companyId: string
    readonly leadId: string
    readonly contact: LeadContact
    readonly campaign: PublicCampaign
    readonly code: string
    /** `true`: a pessoa se cadastrou de novo e pediu o código outra vez. */
    readonly isResend: boolean
  }): Promise<void>
}

/** Encontra ou cria o cliente do host para o contato. Devolve a referência opaca (`customerRef`). */
export interface CustomerIdentityPort {
  resolve(params: { readonly companyId: string; readonly contact: LeadContact }): Promise<string | undefined>
}

export const RATE_LIMIT_ACTION = {
  LEAD_CAPTURE: 'lead-capture',
  VALIDATE: 'validate',
} as const
export type RateLimitAction = (typeof RATE_LIMIT_ACTION)[keyof typeof RATE_LIMIT_ACTION]

/**
 * Limite das rotas públicas. Validar cupom anônimo sem limite é força bruta de código; captar lead
 * sem limite é spam de e-mail em nome da empresa. O host liga ao limitador que já usa (Redis…).
 */
export interface RateLimiterPort {
  consume(params: {
    readonly action: RateLimitAction
    readonly companyId: string
    /** IP do cliente como o host resolveu (atrás de proxy confiável). */
    readonly key: string
  }): Promise<{ readonly allowed: boolean; readonly retryAfterSeconds?: number }>
}

export const COUPON_EVENT = {
  CAMPAIGN_CHANGED: 'campaign-changed',
  LEAD_CAPTURED: 'lead-captured',
  REDEEMED: 'redeemed',
  RELEASED: 'released',
} as const
export type CouponEventType = (typeof COUPON_EVENT)[keyof typeof COUPON_EVENT]

export const EXPORT_KIND = {
  LEADS: 'leads',
  REDEMPTIONS: 'redemptions',
  COUPONS: 'coupons',
} as const
export type ExportKind = (typeof EXPORT_KIND)[keyof typeof EXPORT_KIND]

/** Trilha de auditoria da exportação: quem, o quê, com qual filtro, quantas linhas. Sem o conteúdo. */
export type ExportedEvent = {
  readonly companyId: string
  readonly userId: string | undefined
  readonly campaignId: string
  readonly kind: ExportKind
  readonly format: string
  readonly filters: Readonly<Record<string, unknown>>
  readonly rowCount: number
}

export type CouponHooks = {
  readonly onCampaignChanged?: (event: { readonly campaign: Campaign }) => void | Promise<void>
  /** Uso típico: etiquetar o cliente, abrir conversa. Recebe o lead inteiro; não logue o contato. */
  readonly onLeadCaptured?: (event: { readonly lead: Lead; readonly campaign: Campaign }) => void | Promise<void>
  readonly onRedeemed?: (event: { readonly redemption: Redemption }) => void | Promise<void>
  readonly onReleased?: (event: { readonly redemption: Redemption }) => void | Promise<void>
  /** Exportação é ação sensível: o host grava a auditoria aqui. */
  readonly onExported?: (event: ExportedEvent) => void | Promise<void>
}

export type CouponModuleConfig = {
  /** Escopos aceitos nas rotas do painel. Padrão: `['coupons:admin']`. */
  readonly adminScopes?: readonly string[]
  /** Escopos das rotas de serviço (validar, resgatar, liberar, chamadas pelo backend do host). Padrão: `['coupons:service', 'coupons:admin']`. */
  readonly serviceScopes?: readonly string[]
  /** DDI de telefone nacional. Padrão: `55`. */
  readonly phoneCountryCode?: string
  /** Cabeçalho `Cache-Control` do banner público. */
  readonly publicCacheControl?: string
}

export const DEFAULT_ADMIN_SCOPES: readonly string[] = ['coupons:admin']
export const DEFAULT_SERVICE_SCOPES: readonly string[] = ['coupons:service', 'coupons:admin']
export const DEFAULT_PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=120'
