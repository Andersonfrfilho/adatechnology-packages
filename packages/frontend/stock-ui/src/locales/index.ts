/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import en from './en.json'
import ptBR from './pt-BR.json'

export type StockMessages = typeof ptBR
export type StockLocale = 'pt-BR' | 'en'

const MESSAGES_BY_LOCALE: Record<StockLocale, StockMessages> = { 'pt-BR': ptBR, en }

export function resolveStockMessages(locale: string): StockMessages {
  return MESSAGES_BY_LOCALE[locale as StockLocale] ?? ptBR
}

export function interpolate(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
