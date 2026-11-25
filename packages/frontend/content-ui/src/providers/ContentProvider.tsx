/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import {
  DEFAULT_CONTENT_LOCALE,
  interpolate,
  resolveContentMessages,
  type ContentLocale,
  type ContentMessages,
} from '../locales'
import type { ContentAdminApi, ContentPublicApi, RenderLink, RenderLinkProps } from './types'

type ContentContextValue = {
  readonly adminApi?: ContentAdminApi
  readonly publicApi?: ContentPublicApi
  readonly locale: ContentLocale
  readonly messages: ContentMessages
  readonly renderLink: RenderLink
}

const ContentContext = createContext<ContentContextValue | null>(null)

export type ContentProviderProps = {
  /** Painel: lista e editor. Site público não precisa passar. */
  readonly adminApi?: ContentAdminApi
  /** Site público: lista, página do post. Painel não precisa passar. */
  readonly publicApi?: ContentPublicApi
  readonly locale?: ContentLocale
  /** Sobrescreve textos pontuais (ex.: "Posts" → "Novidades") sem trocar o locale inteiro. */
  readonly messages?: Partial<ContentMessages>
  /** Link do roteador do host. Padrão: `<a>`. */
  readonly renderLink?: RenderLink
  readonly children: ReactNode
}

function defaultRenderLink({ children, ...props }: RenderLinkProps): ReactNode {
  return <a {...props}>{children}</a>
}

export function ContentProvider({
  adminApi,
  publicApi,
  locale = DEFAULT_CONTENT_LOCALE,
  messages,
  renderLink,
  children,
}: ContentProviderProps) {
  const value = useMemo<ContentContextValue>(
    () => ({
      ...(adminApi ? { adminApi } : {}),
      ...(publicApi ? { publicApi } : {}),
      locale,
      messages: { ...resolveContentMessages(locale), ...messages },
      renderLink: renderLink ?? defaultRenderLink,
    }),
    [adminApi, publicApi, locale, messages, renderLink],
  )
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

function useContentContext(): ContentContextValue {
  const value = useContext(ContentContext)
  if (!value) throw new Error('content-ui: componente usado fora de <ContentProvider>')
  return value
}

export function useContentAdminApi(): ContentAdminApi {
  const { adminApi } = useContentContext()
  if (!adminApi) throw new Error('content-ui: <ContentProvider adminApi> é obrigatório no painel')
  return adminApi
}

export function useContentPublicApi(): ContentPublicApi {
  const { publicApi } = useContentContext()
  if (!publicApi) throw new Error('content-ui: <ContentProvider publicApi> é obrigatório no site público')
  return publicApi
}

export type ContentText = {
  readonly messages: ContentMessages
  readonly locale: ContentLocale
  readonly format: (key: keyof ContentMessages, values: Readonly<Record<string, string | number>>) => string
}

export function useContentText(): ContentText {
  const { messages, locale } = useContentContext()
  return useMemo(
    () => ({ messages, locale, format: (key, values) => interpolate(messages[key], values) }),
    [messages, locale],
  )
}

export function useRenderLink(): RenderLink {
  return useContentContext().renderLink
}
