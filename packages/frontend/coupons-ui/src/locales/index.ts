/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Nenhum texto visível vive em componente. O host sobrescreve chaves pontuais por `messages` no
 * provider (o slot de `labels`) sem fornecer um locale inteiro.
 */

import en from './en.json'
import ptBR from './pt-BR.json'

export type CouponsMessages = typeof ptBR
export type CouponsLocale = 'pt-BR' | 'en'

export const DEFAULT_COUPONS_LOCALE: CouponsLocale = 'pt-BR'

const MESSAGES_BY_LOCALE: Record<CouponsLocale, CouponsMessages> = { 'pt-BR': ptBR, en }

export function resolveCouponsMessages(locale: CouponsLocale): CouponsMessages {
  return MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE[DEFAULT_COUPONS_LOCALE]
}

/** `{name}` → valor. Chave sem valor fica como está, para o defeito aparecer em vez de sumir. */
export function interpolate(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
