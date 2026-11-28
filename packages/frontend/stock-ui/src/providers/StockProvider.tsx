/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Vai dentro do `RecipesProvider` do `recipes-ui`: as telas de estoque usam as mesmas peças (campo,
 * seleção, paginação, confirmação), o mesmo idioma e os mesmos tokens `--arc-*`.
 */

import { useRecipesText } from '@adatechnology/recipes-ui'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { interpolate, resolveStockMessages, type StockMessages } from '../locales'
import type { StockApi } from './types'

type StockContextValue = { readonly api: StockApi; readonly messages: StockMessages }

const StockContext = createContext<StockContextValue | null>(null)

export type StockProviderProps = {
  readonly api: StockApi
  readonly messages?: Partial<StockMessages>
  readonly children: ReactNode
}

export function StockProvider({ api, messages, children }: StockProviderProps) {
  const { locale } = useRecipesText()
  const value = useMemo(() => ({ api, messages: { ...resolveStockMessages(locale), ...messages } }), [api, locale, messages])
  return <StockContext.Provider value={value}>{children}</StockContext.Provider>
}

function useStockContext(): StockContextValue {
  const value = useContext(StockContext)
  if (!value) throw new Error('stock-ui: componente usado fora de <StockProvider>')
  return value
}

export function useStockApi(): StockApi {
  return useStockContext().api
}

export type StockText = {
  readonly messages: StockMessages
  readonly locale: string
  readonly format: (key: keyof StockMessages, values: Readonly<Record<string, string | number>>) => string
}

export function useStockText(): StockText {
  const { messages } = useStockContext()
  const { locale } = useRecipesText()
  return useMemo(() => ({ messages, locale, format: (key, values) => interpolate(messages[key], values) }), [messages, locale])
}
