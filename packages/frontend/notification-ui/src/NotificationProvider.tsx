/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Provider do pacote. **Não instancia `QueryClient`** — usa o do host (regra de módulos
 * plugáveis §4.2). Instanciar o próprio criaria dois caches na mesma página: a inbox invalidaria
 * um, e a tela do produto continuaria lendo o outro.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { NotificationClient } from '@adatechnology/notification-client'

import { DEFAULT_LOCALE, resolveMessages, type NotificationLocale, type NotificationMessages } from './locales'

export type NotificationTheme = {
  /** Classe aplicada na raiz de cada componente — é por onde o host injeta os tokens dele. */
  readonly rootClassName?: string
  readonly components?: Partial<Record<string, string>>
}

export type NotificationContextValue = {
  readonly client: NotificationClient
  /**
   * O idioma resolvido, e não só os textos dele: data e número não vivem no arquivo de locale —
   * quem os formata é `Intl`, e `Intl` precisa da tag do idioma. Sem isto o item da lista teria de
   * chutar um locale fixo, e a inbox mostraria "5 minutes ago" numa tela em português.
   */
  readonly locale: NotificationLocale
  readonly messages: NotificationMessages
  readonly theme: NotificationTheme
  /** Polling de fallback quando o SSE não está disponível (segundos); `0` desliga. */
  readonly pollIntervalSeconds: number
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export type NotificationProviderProps = {
  readonly client: NotificationClient
  readonly locale?: NotificationLocale
  /** Sobrescreve textos pontuais sem trocar o locale inteiro. */
  readonly messageOverrides?: Partial<NotificationMessages>
  readonly theme?: NotificationTheme
  readonly pollIntervalSeconds?: number
  readonly children: ReactNode
}

export function NotificationProvider({
  client,
  locale = DEFAULT_LOCALE,
  messageOverrides,
  theme = {},
  pollIntervalSeconds = 60,
  children,
}: NotificationProviderProps) {
  const value = useMemo<NotificationContextValue>(
    () => ({
      client,
      locale,
      messages: { ...resolveMessages(locale), ...messageOverrides },
      theme,
      pollIntervalSeconds,
    }),
    [client, locale, messageOverrides, theme, pollIntervalSeconds],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotificationContext(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('notification-ui: componente usado fora de <NotificationProvider>')
  return context
}
