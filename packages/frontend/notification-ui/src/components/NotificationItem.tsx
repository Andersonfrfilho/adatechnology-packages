/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { Calendar, Check, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { extractCalendarEvent, generateGoogleCalendarUrl, type NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { formatNotificationTime, formatNotificationTimestamp } from '../format/notificationTime'
import { useDeleteNotification, useMarkAsRead } from '../hooks/useNotifications'

export type NotificationItemProps = {
  readonly notification: NotificationSummary
  readonly onSelect?: (notification: NotificationSummary) => void
  readonly className?: string
}

export function NotificationItem({ notification, onSelect, className }: NotificationItemProps) {
  const { locale, messages } = useNotificationContext()
  const markAsRead = useMarkAsRead()
  const deleteNotification = useDeleteNotification()

  const isUnread = notification.readAt === undefined
  const calendarEvent = extractCalendarEvent(notification.payload)

  function handleSelect(): void {
    if (isUnread) markAsRead.mutate(notification.id)
    onSelect?.(notification)
  }

  return (
    <li className={clsx('adn-item', isUnread && 'adn-item--unread', className)}>
      {/* Semântico: a linha inteira é clicável e precisa ser alcançável por teclado — `button`
          entrega Enter, Espaço e foco de graça, e um `div` com onClick não (web.md §Acessibilidade). */}
      <button type="button" className="adn-item__main" onClick={handleSelect}>
        <span className="adn-item__heading">
          {/* Marcador à esquerda, na altura do título: sobreposto ao canto, ele cobria a última
              palavra do texto em linha comprida. */}
          {isUnread ? <span className="adn-item__unread-dot" aria-label={messages['item.unread']} /> : null}
          <span className="adn-item__title">{notification.title}</span>
          {/* `<time>` e não `<span>`: a data legível por máquina é o que um leitor de tela e um
              agregador conseguem interpretar; o texto visível é o relativo, que é o que se lê. */}
          <time
            className="adn-item__time"
            dateTime={notification.createdAt}
            title={formatNotificationTimestamp(notification.createdAt, locale)}
          >
            {formatNotificationTime(notification.createdAt, locale, new Date())}
          </time>
        </span>
        <span className="adn-item__body">{notification.body}</span>
        {calendarEvent ? (
          <span className="adn-item__calendar-wrapper">
            <a
              href={generateGoogleCalendarUrl(calendarEvent)}
              target="_blank"
              rel="noopener noreferrer"
              className="adn-item__calendar-link"
              onClick={(e) => e.stopPropagation()}
              title={messages['item.addToCalendar'] ?? 'Adicionar à agenda'}
            >
              <Calendar size={12} aria-hidden="true" />
              <span>{messages['item.addToCalendar'] ?? 'Adicionar à agenda'}</span>
            </a>
          </span>
        ) : null}
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
