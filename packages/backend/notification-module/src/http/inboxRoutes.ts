/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rotas de inbox e stream. Cada handler recebe o contexto já validado e autenticado por
 * `dispatchRoute` — daí não haver `try/catch` nem checagem de escopo aqui dentro.
 */

import {
  NOTIFICATION_EVENT,
  listNotificationsQuerySchema,
  type NotificationRoute,
  type SseEvent,
} from '@adatechnology/notification-contracts'

import type { NotificationModule } from '../NotificationModule'
import { requireUser } from './requireUser'

export const DEFAULT_SSE_HEARTBEAT_SECONDS = 25

export function buildInboxRoutes(params: {
  module: NotificationModule
  heartbeatSeconds?: number
}): NotificationRoute[] {
  const { useCases, realtime } = params.module

  return [
    {
      method: 'GET',
      path: '/notifications',
      scope: 'user',
      querySchema: listNotificationsQuerySchema,
      operationId: 'listNotifications',
      summary: 'Lista a inbox do usuário autenticado',
      async handler(context) {
        const auth = requireUser(context)
        const query = context.query as unknown as {
          category?: string
          read?: boolean
          cursor?: string
          perPage: number
        }
        const result = await useCases.listNotifications.execute({
          companyId: auth.companyId,
          recipientUserId: auth.userId,
          category: query.category,
          read: query.read,
          cursor: query.cursor,
          perPage: query.perPage,
        })

        return {
          kind: 'json',
          status: 200,
          body: {
            data: result.data,
            pagination: { nextCursor: result.nextCursor, perPage: query.perPage },
            meta: { unreadCount: result.unreadCount },
          },
        }
      },
    },

    {
      method: 'GET',
      path: '/notifications/unread-count',
      scope: 'user',
      operationId: 'countUnreadNotifications',
      summary: 'Contador de não lidas do usuário autenticado',
      async handler(context) {
        const auth = requireUser(context)
        const unreadCount = await useCases.countUnread.execute({
          companyId: auth.companyId,
          recipientUserId: auth.userId,
        })
        return { kind: 'json', status: 200, body: { data: { unreadCount } } }
      },
    },

    {
      method: 'GET',
      path: '/notifications/stream',
      scope: 'user',
      operationId: 'streamNotifications',
      summary: 'SSE com o badge da inbox em tempo real',
      async handler(context) {
        const auth = requireUser(context)

        return {
          kind: 'stream',
          heartbeatSeconds: params.heartbeatSeconds ?? DEFAULT_SSE_HEARTBEAT_SECONDS,
          async subscribe(emit: (event: SseEvent) => void) {
            // Primeiro evento imediato: sem ele, uma aba recém-aberta ficaria com o badge zerado
            // até a próxima notificação chegar.
            const unreadCount = await useCases.countUnread.execute({
              companyId: auth.companyId,
              recipientUserId: auth.userId,
            })
            emit({ event: 'unread-count', data: JSON.stringify({ unreadCount }) })

            if (!realtime?.subscribe) {
              // Sem porta de assinatura o stream não tem fonte de eventos — mantém a conexão viva
              // (o heartbeat do adaptador continua) e o cliente segue no polling do refetch.
              return { close: () => {} }
            }

            return realtime.subscribe({
              companyId: auth.companyId,
              userId: auth.userId,
              onEvent: (event) => {
                emit({ event: event.event, data: JSON.stringify(event.data) })
              },
            })
          },
        }
      },
    },

    {
      method: 'PATCH',
      path: '/notifications/:id/read',
      scope: 'user',
      operationId: 'markNotificationAsRead',
      summary: 'Marca uma notificação como lida',
      async handler(context) {
        const auth = requireUser(context)
        const notification = await useCases.markAsRead.execute({
          companyId: auth.companyId,
          recipientUserId: auth.userId,
          id: context.params.id ?? '',
        })
        await realtime?.publish({
          companyId: auth.companyId,
          userId: auth.userId,
          event: NOTIFICATION_EVENT.READ,
          data: { notificationId: notification.id },
        })
        return { kind: 'json', status: 200, body: { data: notification } }
      },
    },

    {
      method: 'POST',
      path: '/notifications/read-all',
      scope: 'user',
      operationId: 'markAllNotificationsAsRead',
      summary: 'Marca todas as notificações como lidas',
      async handler(context) {
        const auth = requireUser(context)
        const updated = await useCases.markAllAsRead.execute({
          companyId: auth.companyId,
          recipientUserId: auth.userId,
        })
        return { kind: 'json', status: 200, body: { data: { updated } } }
      },
    },

    {
      method: 'DELETE',
      path: '/notifications/:id',
      scope: 'user',
      operationId: 'deleteNotification',
      summary: 'Remove uma notificação da inbox',
      async handler(context) {
        const auth = requireUser(context)
        await useCases.deleteNotification.execute({
          companyId: auth.companyId,
          recipientUserId: auth.userId,
          id: context.params.id ?? '',
        })
        return { kind: 'empty', status: 204 }
      },
    },
  ]
}
