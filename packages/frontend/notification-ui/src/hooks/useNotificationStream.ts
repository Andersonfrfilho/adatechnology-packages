/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToNotificationStream } from '@adatechnology/notification-client'

import { useNotificationContext } from '../NotificationProvider'
import { NOTIFICATION_QUERY_KEYS } from './queryKeys'

export type UseNotificationStreamOptions = {
  /** Desligado por omissão: abrir SSE é decisão do host, que sabe se o backend expõe a rota. */
  readonly enabled?: boolean
  readonly onEvent?: (event: { event: string; data: unknown }) => void
}

/**
 * Liga o SSE do inbox ao cache do TanStack: cada evento invalida as chaves, e o badge e a lista
 * atualizam juntos. `useEffect` aqui é o uso correto do hook — sincronizar com um sistema externo
 * (`react.md`, "useEffect só para sincronizar com sistemas externos"), não transformar dado.
 */
export function useNotificationStream(options: UseNotificationStreamOptions = {}): void {
  const { client } = useNotificationContext()
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? false
  const onEvent = options.onEvent

  useEffect(() => {
    if (!enabled) return

    let subscription: { close(): void } | undefined
    let cancelled = false

    void client.resolveStreamRequest().then(({ url, headers }) => {
      // A resolução do token é assíncrona; se o componente desmontou nesse meio-tempo, não abre
      // conexão nenhuma — senão sobraria um stream órfão a cada navegação rápida.
      if (cancelled) return

      subscription = subscribeToNotificationStream({
        url,
        headers,
        onEvent: (event) => {
          onEvent?.(event)
          void queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
        },
      })
    })

    return () => {
      cancelled = true
      subscription?.close()
    }
  }, [client, queryClient, enabled, onEvent])
}
