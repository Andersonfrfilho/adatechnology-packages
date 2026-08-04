/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Check, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { useDeleteNotification, useMarkAsRead } from '../hooks/useNotifications'

export type NotificationItemProps = {
  readonly notification: NotificationSummary
  readonly onSelect?: (notification: NotificationSummary) => void
  readonly className?: string
}

export function NotificationItem({ notification, onSelect, className }: NotificationItemProps) {
  const { messages } = useNotificationContext()
  const markAsRead = useMarkAsRead()
  const deleteNotification = useDeleteNotification()

  const isUnread = notification.readAt === undefined

  function handleSelect(): void {
    if (isUnread) markAsRead.mutate(notification.id)
    onSelect?.(notification)
  }

  return (
    <li className={clsx('adn-item', isUnread && 'adn-item--unread', className)}>
      {/* Semântico: a linha inteira é clicável e precisa ser alcançável por teclado — `button`
          entrega Enter, Espaço e foco de graça, e um `div` com onClick não (web.md §Acessibilidade). */}
      <button type="button" className="adn-item__main" onClick={handleSelect}>
        <span className="adn-item__title">{notification.title}</span>
        <span className="adn-item__body">{notification.body}</span>
        {isUnread ? <span className="adn-item__unread-dot" aria-label={messages['item.unread']} /> : null}
      </button>

      <div className="adn-item__actions">
        {isUnread ? (
          <button
            type="button"
            className="adn-item__action"
            onClick={() => markAsRead.mutate(notification.id)}
            disabled={markAsRead.isPending}
            aria-label={messages['item.markAsRead']}
            title={messages['item.markAsRead']}
          >
            <Check className="adn-item__action-icon" aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          className="adn-item__action adn-item__action--danger"
          onClick={() => deleteNotification.mutate(notification.id)}
          disabled={deleteNotification.isPending}
          aria-label={messages['item.delete']}
          title={messages['item.delete']}
        >
          {/* Ação destrutiva: ícone reforça o peso antes do clique (regra de ícones). */}
          <Trash2 className="adn-item__action-icon" aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
