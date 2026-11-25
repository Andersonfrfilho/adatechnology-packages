/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Nenhum texto visível vive em componente. O host sobrescreve chaves pontuais por `messages` no
 * provider sem fornecer um locale inteiro — inclusive para trocar "post" pelo vocabulário dele.
 */

import en from './en.json'
import ptBR from './pt-BR.json'

export type ContentMessages = typeof ptBR
export type ContentLocale = 'pt-BR' | 'en'

export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'pt-BR'

const MESSAGES_BY_LOCALE: Record<ContentLocale, ContentMessages> = { 'pt-BR': ptBR, en }

export function resolveContentMessages(locale: ContentLocale): ContentMessages {
  return MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE[DEFAULT_CONTENT_LOCALE]
}

/** `{name}` → valor. Chave sem valor fica como está, para o defeito aparecer em vez de sumir. */
export function interpolate(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
