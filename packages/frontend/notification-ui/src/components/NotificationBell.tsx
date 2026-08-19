/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Bell } from 'lucide-react'
import clsx from 'clsx'

import { useNotificationContext } from '../NotificationProvider'
import { useUnreadCount } from '../hooks/useNotifications'

export type NotificationBellProps = {
  readonly onClick?: () => void
  readonly className?: string
  /** Acima disso o badge mostra `99+`; um número de 4 dígitos estoura o desenho do badge. */
  readonly maxBadgeCount?: number
}

const DEFAULT_MAX_BADGE_COUNT = 99

export function NotificationBell({
  onClick,
  className,
  maxBadgeCount = DEFAULT_MAX_BADGE_COUNT,
}: NotificationBellProps) {
  const { messages, theme } = useNotificationContext()
  const { data: unreadCount = 0 } = useUnreadCount()

  const hasUnread = unreadCount > 0
  const badgeLabel = unreadCount > maxBadgeCount ? `${maxBadgeCount}+` : String(unreadCount)
  const accessibleLabel = hasUnread
    ? `${messages['bell.label']}: ${unreadCount} ${messages['bell.unreadSuffix']}`
    : messages['bell.label']

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('adn-bell', theme.rootClassName, className)}
      // Botão só-ícone exige rótulo acessível (regra de ícones, `web.md` §9).
      aria-label={accessibleLabel}
    >
      {/* Decorativo: o rótulo acessível já está no botão, e anunciar o ícone repetiria a ação. */}
      <Bell className="adn-bell__icon" aria-hidden="true" />
      {hasUnread ? (
        // `aria-live` para leitor de tela anunciar a mudança do contador sem o usuário reabrir
        // o menu; `polite` porque notificação nova não deve interromper o que ele está lendo.
        <span className="adn-bell__badge" aria-live="polite">
          {badgeLabel}
        </span>
      ) : null}
    </button>
  )
}
