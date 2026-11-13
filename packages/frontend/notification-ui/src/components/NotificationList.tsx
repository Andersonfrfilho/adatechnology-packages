/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { CheckCheck, Inbox, RotateCw } from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { flattenNotificationPages, useMarkAllAsRead, useNotifications, useUnreadCount } from '../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'

/** Três linhas: o bastante para a lista já ter a forma dela antes de ter conteúdo. */
const SKELETON_ROWS = [0, 1, 2]

export type NotificationListProps = {
  readonly category?: string
  readonly onSelect?: (notification: NotificationSummary) => void
  readonly className?: string
  /**
   * Substitui o vazio padrão. Quem decide se está vazio é a lista — o host que desenhava o próprio
   * vazio ao lado dela mostrava "nada por aqui" embaixo das notificações que estavam ali.
   */
  readonly renderEmpty?: () => ReactNode
  /** Slot: o host troca a linha sem reimplementar a lista (regra §4.3, slots e overrides). */
  readonly components?: { readonly Item?: typeof NotificationItem }
}

export function NotificationList({ category, onSelect, className, renderEmpty, components }: NotificationListProps) {
  const { messages, theme } = useNotificationContext()
  const query = useNotifications({ category })
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllAsRead = useMarkAllAsRead()

  const Item = components?.Item ?? NotificationItem
  const notifications = flattenNotificationPages(query.data?.pages)
  const isEmpty = !query.isPending && !query.isError && notifications.length === 0

  return (
    <section className={clsx('adn-list', theme.rootClassName, className)} aria-label={messages['list.title']}>
      <header className="adn-list__header">
        <div className="adn-list__heading">
          <h2 className="adn-list__title">{messages['list.title']}</h2>
          {/* O contador estava só no sino. Quem abriu a tela pelo menu lateral não passou pelo sino,
              e ficava sem saber quantas ainda pedem atenção. */}
          {unreadCount > 0 ? (
            <span className="adn-list__count" role="status" aria-label={`${unreadCount} ${messages['list.unread']}`}>
              {unreadCount}
            </span>
          ) : null}
        </div>

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

      {/* Esqueleto com a forma da linha real, em vez de "Carregando…" centralizado: o texto some e o
          conteúdo entra de altura diferente, e a tela pisca a cada carregamento. */}
      {query.isPending ? (
        <div className="adn-list__skeleton" role="status" aria-label={messages['list.loading']}>
          {SKELETON_ROWS.map((row) => (
            <span key={row} className="adn-list__skeleton-row" />
          ))}
        </div>
      ) : null}

      {query.isError ? (
        <div className="adn-list__state adn-list__state--error" role="alert">
          <p>{messages['list.error']}</p>
          <button type="button" className="adn-list__retry" onClick={() => void query.refetch()}>
            <RotateCw className="adn-list__retry-icon" aria-hidden="true" />
            {messages['list.retry']}
          </button>
        </div>
      ) : null}

      {isEmpty
        ? (renderEmpty?.() ?? (
            <div className="adn-list__state adn-list__state--empty">
              <Inbox className="adn-list__empty-icon" aria-hidden="true" />
              <p>{messages['list.empty']}</p>
            </div>
          ))
        : null}

      {notifications.length > 0 ? (
        <ul className="adn-list__items">
          {notifications.map((notification) => (
            <Item key={notification.id} notification={notification} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}

      {query.hasNextPage ? (
        <div className="adn-list__footer">
          <button
            type="button"
            className="adn-list__load-more"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {messages['list.loadMore']}
          </button>
        </div>
      ) : null}
    </section>
  )
}
