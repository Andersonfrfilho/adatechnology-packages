/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Camada headless — a válvula de escape do item 4 da §4 da regra de módulos plugáveis: quando a
 * tela default não serve, o produto monta a própria sobre estes mesmos hooks e continua herdando
 * upgrades de lógica.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationSummary } from '@adatechnology/notification-contracts'

import { useNotificationContext } from '../NotificationProvider'
import { NOTIFICATION_QUERY_KEYS } from './queryKeys'

export type UseNotificationsOptions = {
  readonly category?: string
  readonly read?: boolean
  readonly perPage?: number
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { client } = useNotificationContext()

  return useInfiniteQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list({ category: options.category, read: options.read }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      client.listNotifications({
        category: options.category,
        read: options.read,
        cursor: pageParam,
        perPage: options.perPage,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}

export function useUnreadCount() {
  const { client, pollIntervalSeconds } = useNotificationContext()

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => client.countUnread(),
    // Polling é o fallback de quem não ligou o SSE. Com o stream ativo,
    // `useNotificationStream` invalida esta chave e o refetch acontece na hora.
    refetchInterval: pollIntervalSeconds > 0 ? pollIntervalSeconds * 1000 : false,
  })
}

export function useMarkAsRead() {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => client.markAsRead(id),
    async onMutate(id: string) {
      // Atualização otimista: marcar como lida é ação de um clique, e esperar o round-trip para
      // o badge cair faz a interface parecer travada.
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      const previousCount = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount())

      queryClient.setQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount(), (current) =>
        current === undefined ? current : Math.max(0, current - 1),
      )
      return { previousCount, id }
    },
    onError(_error, _id, context) {
      // Rollback: sem isto o badge ficaria mentindo até o próximo refetch.
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), context.previousCount)
      }
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
    },
  })
}

export function useMarkAllAsRead() {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => client.markAllAsRead(),
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
    },
  })
}

export function useDeleteNotification() {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => client.deleteNotification(id),
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
    },
  })
}

/** Achata as páginas do infinite query — a lista quase sempre quer o array direto. */
export function flattenNotificationPages(
  pages: readonly { data: readonly NotificationSummary[] }[] | undefined,
): readonly NotificationSummary[] {
  return pages?.flatMap((page) => page.data) ?? []
}
