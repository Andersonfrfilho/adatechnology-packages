/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Componente acessível de aviso para permitir ou desativar notificações do navegador (Web Push).
 */

import React from 'react'
import { Bell, BellOff, BellRing, X } from 'lucide-react'
import clsx from 'clsx'
import type { WebPushSubscription } from '@adatechnology/notification-contracts'

import { useOptionalNotificationContext } from '../NotificationProvider'
import { resolveMessages, DEFAULT_LOCALE } from '../locales'
import { useNotificationPermission } from '../hooks/useNotificationPermission'

export type NotificationPermissionBannerProps = {
  /** Chave pública VAPID para registro do Web Push. */
  readonly vapidPublicKey?: string
  /** Chave do localStorage para persistir a dispensa do banner. */
  readonly storageKey?: string
  /** Mostra o banner quando as notificações já estão ativas (permite desativação). Padrão: false */
  readonly showWhenGranted?: boolean
  /** Mostra o banner informativo quando as notificações foram bloqueadas no navegador. Padrão: true */
  readonly showWhenDenied?: boolean
  /** Callback opcional ao se inscrever com sucesso. */
  readonly onSubscribe?: (subscription: WebPushSubscription) => void | Promise<void>
  /** Callback opcional ao desativar notificações. */
  readonly onUnsubscribe?: () => void | Promise<void>
  /** Callback disparado quando o usuário clica em dispensar/fechar. */
  readonly onDismiss?: () => void
  /** Classe CSS customizada para o contêiner raiz. */
  readonly className?: string
}

export function NotificationPermissionBanner({
  vapidPublicKey,
  storageKey,
  showWhenGranted = false,
  showWhenDenied = true,
  onSubscribe,
  onUnsubscribe,
  onDismiss,
  className,
}: NotificationPermissionBannerProps) {
  const context = useOptionalNotificationContext()
  const messages = context?.messages ?? resolveMessages(DEFAULT_LOCALE)
  const theme = context?.theme ?? {}

  const {
    permission,
    isSupported,
    isDismissed,
    isPending,
    requestPermission,
    disableNotifications,
    dismiss,
  } = useNotificationPermission({
    vapidPublicKey,
    storageKey,
    onSubscribe,
    onUnsubscribe,
  })

  // Não renderiza em ambientes sem suporte nativo a Web Push
  if (!isSupported) {
    return null
  }

  const handleDismiss = () => {
    dismiss()
    onDismiss?.()
  }

  // 1. Estado Prompt: convite amigável para ativar notificações
  if (permission === 'default') {
    if (isDismissed) return null

    return (
      <aside
        className={clsx('adn-permission-banner adn-permission-banner--prompt', theme.rootClassName, className)}
        role="region"
        aria-label={messages['banner.title']}
      >
        <Bell className="adn-permission-banner__icon" aria-hidden="true" />
        <div className="adn-permission-banner__content">
          <h3 className="adn-permission-banner__title">{messages['banner.title']}</h3>
          <p className="adn-permission-banner__description">{messages['banner.description']}</p>
          <div className="adn-permission-banner__actions">
            <button
              type="button"
              className="adn-permission-banner__allow-button"
              onClick={() => void requestPermission()}
              disabled={isPending}
            >
              {messages['banner.allow']}
            </button>
            <button
              type="button"
              className="adn-permission-banner__dismiss-button"
              onClick={handleDismiss}
            >
              {messages['banner.dismiss']}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="adn-permission-banner__close-button"
          onClick={handleDismiss}
          aria-label={messages['banner.dismiss']}
        >
          <X className="adn-permission-banner__close-icon" aria-hidden="true" />
        </button>
      </aside>
    )
  }

  // 2. Estado Ativo: permite ao usuário desativar notificações
  if (permission === 'granted') {
    if (!showWhenGranted) return null

    return (
      <aside
        className={clsx('adn-permission-banner adn-permission-banner--granted', theme.rootClassName, className)}
        role="region"
        aria-label={messages['banner.activeTitle']}
      >
        <BellRing className="adn-permission-banner__icon" aria-hidden="true" />
        <div className="adn-permission-banner__content">
          <h3 className="adn-permission-banner__title">{messages['banner.activeTitle']}</h3>
          <p className="adn-permission-banner__description">{messages['banner.activeDescription']}</p>
          <div className="adn-permission-banner__actions">
            <button
              type="button"
              className="adn-permission-banner__disable-button"
              onClick={() => void disableNotifications()}
              disabled={isPending}
            >
              {isPending ? messages['banner.disabling'] : messages['banner.disable']}
            </button>
          </div>
        </div>
      </aside>
    )
  }

  // 3. Estado Bloqueado: orienta o usuário de que o navegador negou a permissão
  if (permission === 'denied') {
    if (!showWhenDenied || isDismissed) return null

    return (
      <aside
        className={clsx('adn-permission-banner adn-permission-banner--denied', theme.rootClassName, className)}
        role="alert"
        aria-label={messages['banner.deniedTitle']}
      >
        <BellOff className="adn-permission-banner__icon" aria-hidden="true" />
        <div className="adn-permission-banner__content">
          <h3 className="adn-permission-banner__title">{messages['banner.deniedTitle']}</h3>
          <p className="adn-permission-banner__description">{messages['banner.deniedDescription']}</p>
        </div>
        <button
          type="button"
          className="adn-permission-banner__close-button"
          onClick={handleDismiss}
          aria-label={messages['banner.dismiss']}
        >
          <X className="adn-permission-banner__close-icon" aria-hidden="true" />
        </button>
      </aside>
    )
  }

  return null
}
