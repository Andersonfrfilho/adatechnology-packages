/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Nenhum texto visível vive em tag ou prop (`web.md` §6). O host sobrescreve chaves pontuais via
 * `messageOverrides` sem precisar fornecer um locale inteiro.
 */

import ptBR from './pt-BR.json'
import en from './en.json'

export type NotificationMessages = typeof ptBR
export type NotificationLocale = 'pt-BR' | 'en'

export const DEFAULT_LOCALE: NotificationLocale = 'pt-BR'

const MESSAGES_BY_LOCALE: Record<NotificationLocale, NotificationMessages> = {
  'pt-BR': ptBR,
  en: en as NotificationMessages,
}

export function resolveMessages(locale: NotificationLocale): NotificationMessages {
  return MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE[DEFAULT_LOCALE]
}
