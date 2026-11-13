/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * As portas que só o host pode responder. Todas opcionais: sem elas o módulo funciona, com menos
 * conferência.
 */

/**
 * Confere se o anunciante existe — tipicamente uma busca no `customer-module`. Sem a porta, o id é
 * aceito como veio (o módulo não tem como saber de outro schema).
 */
export type SponsorDirectoryPort = {
  exists(params: { readonly sponsorId: string; readonly companyId?: string }): Promise<boolean>
}

/**
 * O gancho da assinatura. Quando o produto passar a cobrar, esta porta responde se o anunciante
 * pode rodar o plano agora; o módulo de cobrança implementa, este pacote só pergunta.
 *
 * É consultada ao criar ou reativar campanha e, de novo, ao montar o feed: assinatura que venceu
 * tira o anúncio do ar sem ninguém precisar pausar a campanha na mão.
 */
export type CampaignEntitlementPort = {
  isEntitled(params: {
    readonly sponsorId: string
    readonly plan: string
    readonly companyId?: string
    readonly at: Date
  }): Promise<boolean>
}

/** Relógio injetável, para o teste não depender do relógio da máquina. */
export type ClockPort = { now(): Date }

/** Sorteio do desempate. Injetável para o teste ser determinístico. */
export type RandomPort = { next(): number }

export type LogMeta = Readonly<Record<string, unknown>>

export type LoggerPort = {
  info(event: string, meta?: LogMeta): void
  warn(event: string, meta?: LogMeta): void
  error(event: string, meta?: LogMeta): void
}
