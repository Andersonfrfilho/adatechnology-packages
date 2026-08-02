/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CheckCheck, Inbox, RotateCw } from 'lucide-react'
import clsx from 'clsx'
import type { NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { flattenNotificationPages, useMarkAllAsRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'

export type NotificationListProps = {
  readonly category?: string
  readonly onSelect?: (notification: NotificationSummary) => void
  readonly className?: string
  /** Slot: o host troca a linha sem reimplementar a lista (regra §4.3, slots e overrides). */
  readonly components?: { readonly Item?: typeof NotificationItem }
}

export function NotificationList({ category, onSelect, className, components }: NotificationListProps) {
  const { messages, theme } = useNotificationContext()
  const query = useNotifications({ category })
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllAsRead = useMarkAllAsRead()

  const Item = components?.Item ?? NotificationItem
  const notifications = flattenNotificationPages(query.data?.pages)

  return (
    <section className={clsx('adn-list', theme.rootClassName, className)} aria-label={messages['list.title']}>
      <header className="adn-list__header">
        <h2 className="adn-list__title">{messages['list.title']}</h2>
        {unreadCount > 0 ? (
          <button
            type="button"
            className="adn-list__bulk-action"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCheck className="adn-list__bulk-icon" aria-hidden="true" />
            {messages['list.markAllAsRead']}
          </button>
        ) : null}
      </header>

      {query.isPending ? <p className="adn-list__state">{messages['list.loading']}</p> : null}

      {query.isError ? (
        <div className="adn-list__state adn-list__state--error">
          <p>{messages['list.error']}</p>
          <button type="button" className="adn-list__retry" onClick={() => void query.refetch()}>
            <RotateCw className="adn-list__retry-icon" aria-hidden="true" />
            {messages['list.retry']}
          </button>
        </div>
      ) : null}

      {!query.isPending && !query.isError && notifications.length === 0 ? (
        <div className="adn-list__state adn-list__state--empty">
          <Inbox className="adn-list__empty-icon" aria-hidden="true" />
          <p>{messages['list.empty']}</p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <ul className="adn-list__items">
          {notifications.map((notification) => (
            <Item key={notification.id} notification={notification} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}

      {query.hasNextPage ? (
        <button
          type="button"
          className="adn-list__load-more"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {messages['list.loadMore']}
        </button>
      ) : null}
    </section>
  )
}
