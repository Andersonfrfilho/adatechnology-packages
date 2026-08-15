/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Textos internos dos componentes (rótulos de campo, dias da semana, status). Vocabulário da moldura
 * do workspace (título, abas) é responsabilidade de `workspace/labels.ts` — separado porque o host
 * troca o nome de uma aba com muito mais frequência do que troca "Domingo" por outra palavra.
 */

import ptBR from './pt-BR.json'
import en from './en.json'

export type SchedulingMessages = typeof ptBR
export type SchedulingLocale = 'pt-BR' | 'en'

export const DEFAULT_SCHEDULING_LOCALE: SchedulingLocale = 'pt-BR'

const MESSAGES_BY_LOCALE: Record<SchedulingLocale, SchedulingMessages> = {
  'pt-BR': ptBR,
  en: en as SchedulingMessages,
}

export function resolveSchedulingMessages(locale: string): SchedulingMessages {
  return MESSAGES_BY_LOCALE[locale as SchedulingLocale] ?? MESSAGES_BY_LOCALE[DEFAULT_SCHEDULING_LOCALE]
}
