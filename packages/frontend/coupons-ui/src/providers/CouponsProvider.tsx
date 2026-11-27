/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  DEFAULT_COUPONS_LOCALE,
  interpolate,
  resolveCouponsMessages,
  type CouponsLocale,
  type CouponsMessages,
} from '../locales'
import type {
  CouponsAdminApi,
  CouponsPublicApi,
  RenderDateRangeInput,
  RenderDateTimeInput,
  RenderSelect,
} from './types'

type CouponsContextValue = {
  readonly adminApi?: CouponsAdminApi
  readonly publicApi?: CouponsPublicApi
  readonly locale: CouponsLocale
  readonly messages: CouponsMessages
  readonly currency: string
  readonly timeZone?: string
  readonly renderSelect?: RenderSelect
  readonly renderDateTimeInput?: RenderDateTimeInput
  readonly renderDateRangeInput?: RenderDateRangeInput
}

const CouponsContext = createContext<CouponsContextValue | null>(null)

export type CouponsProviderProps = {
  /** Painel: lista, editor, códigos, contatos, usos. */
  readonly adminApi?: CouponsAdminApi
  /** Site: banner, campo de cupom, captação. */
  readonly publicApi?: CouponsPublicApi
  readonly locale?: CouponsLocale
  /** Slot de rótulos: troca textos pontuais ("Campanhas" → "Promoções") sem trocar o locale. */
  readonly messages?: Partial<CouponsMessages>
  /** Moeda ISO 4217 dos valores. Padrão: `BRL`. */
  readonly currency?: string
  /**
   * Fuso IANA da empresa (ex.: `America/Sao_Paulo`). Datas da campanha são digitadas e mostradas
   * nele, e o campo diz qual é. Ausente: fuso do navegador.
   */
  readonly timeZone?: string
  /** Menu de seleção do design system do host (padrão: `<select>` nativo, só em listas curtas). */
  readonly renderSelect?: RenderSelect
  /** Seletor de data e hora do host (padrão: dois campos com máscara, do pacote). */
  readonly renderDateTimeInput?: RenderDateTimeInput
  /** Seletor de intervalo de datas do host para o filtro de período (padrão: dois campos com máscara). */
  readonly renderDateRangeInput?: RenderDateRangeInput
  readonly children: ReactNode
}

export function CouponsProvider({
  adminApi,
  publicApi,
  locale = DEFAULT_COUPONS_LOCALE,
  messages,
  currency = 'BRL',
  timeZone,
  renderSelect,
  renderDateTimeInput,
  renderDateRangeInput,
  children,
}: CouponsProviderProps) {
  const value = useMemo<CouponsContextValue>(
    () => ({
      ...(adminApi ? { adminApi } : {}),
      ...(publicApi ? { publicApi } : {}),
      ...(renderSelect ? { renderSelect } : {}),
      ...(renderDateTimeInput ? { renderDateTimeInput } : {}),
      ...(renderDateRangeInput ? { renderDateRangeInput } : {}),
      ...(timeZone ? { timeZone } : {}),
      locale,
      currency,
      messages: { ...resolveCouponsMessages(locale), ...messages },
    }),
    [
      adminApi,
      publicApi,
      locale,
      messages,
      currency,
      timeZone,
      renderSelect,
      renderDateTimeInput,
      renderDateRangeInput,
    ],
  )
  return <CouponsContext.Provider value={value}>{children}</CouponsContext.Provider>
}

export function useCouponsContext(): CouponsContextValue {
  const value = useContext(CouponsContext)
  if (!value) throw new Error('coupons-ui: componente usado fora de <CouponsProvider>')
  return value
}

export function useCouponsAdminApi(): CouponsAdminApi {
  const { adminApi } = useCouponsContext()
  if (!adminApi) throw new Error('coupons-ui: <CouponsProvider adminApi> é obrigatório no painel')
  return adminApi
}

/** No site a API é opcional: componente sem a função que precisa simplesmente não aparece. */
export function useCouponsPublicApi(): CouponsPublicApi {
  return useCouponsContext().publicApi ?? {}
}

export type CouponsText = {
  readonly messages: CouponsMessages
  readonly locale: CouponsLocale
  readonly currency: string
  /** Fuso da empresa, se o host informou. */
  readonly timeZone: string | undefined
  readonly format: (key: keyof CouponsMessages, values: Readonly<Record<string, string | number>>) => string
}

export function useCouponsText(): CouponsText {
  const { messages, locale, currency, timeZone } = useCouponsContext()
  return useMemo(
    () => ({ messages, locale, currency, timeZone, format: (key, values) => interpolate(messages[key], values) }),
    [messages, locale, currency, timeZone],
  )
}
