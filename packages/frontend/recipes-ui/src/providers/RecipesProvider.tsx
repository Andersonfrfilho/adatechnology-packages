/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  DEFAULT_RECIPES_LOCALE,
  interpolate,
  resolveRecipesMessages,
  type RecipesLocale,
  type RecipesMessages,
} from '../locales'
import type { RecipesApi, RenderSelect } from './types'

type RecipesContextValue = {
  readonly api: RecipesApi
  readonly locale: RecipesLocale
  readonly messages: RecipesMessages
  readonly currency: string
  readonly renderSelect?: RenderSelect
}

const RecipesContext = createContext<RecipesContextValue | null>(null)

export type RecipesProviderProps = {
  readonly api: RecipesApi
  readonly locale?: RecipesLocale
  /** Slot de rótulos: troca textos pontuais ("Insumos" → "Matérias-primas") sem trocar o locale. */
  readonly messages?: Partial<RecipesMessages>
  /** Moeda ISO 4217 dos custos. Padrão: `BRL`. */
  readonly currency?: string
  /** Menu de seleção do design system do host (padrão: botões ou lista do pacote, nunca `<select>`). */
  readonly renderSelect?: RenderSelect
  readonly children: ReactNode
}

export function RecipesProvider({
  api,
  locale = DEFAULT_RECIPES_LOCALE,
  messages,
  currency = 'BRL',
  renderSelect,
  children,
}: RecipesProviderProps) {
  const value = useMemo<RecipesContextValue>(
    () => ({
      api,
      locale,
      currency,
      ...(renderSelect ? { renderSelect } : {}),
      messages: { ...resolveRecipesMessages(locale), ...messages },
    }),
    [api, locale, messages, currency, renderSelect],
  )
  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>
}

export function useRecipesContext(): RecipesContextValue {
  const value = useContext(RecipesContext)
  if (!value) throw new Error('recipes-ui: componente usado fora de <RecipesProvider>')
  return value
}

export function useRecipesApi(): RecipesApi {
  return useRecipesContext().api
}

export type RecipesText = {
  readonly messages: RecipesMessages
  readonly locale: RecipesLocale
  readonly currency: string
  readonly format: (key: keyof RecipesMessages, values: Readonly<Record<string, string | number>>) => string
}

export function useRecipesText(): RecipesText {
  const { messages, locale, currency } = useRecipesContext()
  return useMemo(
    () => ({ messages, locale, currency, format: (key, values) => interpolate(messages[key], values) }),
    [messages, locale, currency],
  )
}
