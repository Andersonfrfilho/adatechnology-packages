/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Default do módulo quando o host não injeta um notificador próprio.
 *
 * **Limite explícito:** entrega só a assinantes da MESMA instância. Com mais de uma réplica atrás
 * de um balanceador, o usuário conectado na réplica A não recebe o evento que nasceu na B, e o
 * badge dele fica parado até o próximo refetch. Quem roda múltiplas instâncias implementa
 * `RealtimeNotifierPort` sobre o pub/sub do host — o `subscribe` da porta existe para isso.
 */

import type { RealtimeEvent, RealtimeNotifierPort, RealtimeSubscription } from '@adatechnology/notification-contracts'

type Listener = (event: RealtimeEvent) => void

function subscriberKey(companyId: string, userId: string): string {
  return `${companyId}:${userId}`
}

export function createInProcessRealtimeNotifier(): RealtimeNotifierPort {
  const listenersByUser = new Map<string, Set<Listener>>()

  return {
    async publish(params): Promise<void> {
      const listeners = listenersByUser.get(subscriberKey(params.companyId, params.userId))
      if (!listeners) return
      // Cópia antes de iterar: um listener que se fecha durante o próprio evento mutaria o Set
      // em iteração.
      for (const listener of [...listeners]) {
        listener({ event: params.event, data: params.data })
      }
    },

    async subscribe(params): Promise<RealtimeSubscription> {
      const key = subscriberKey(params.companyId, params.userId)
      const listeners = listenersByUser.get(key) ?? new Set<Listener>()
      listeners.add(params.onEvent)
      listenersByUser.set(key, listeners)

      return {
        close(): void {
          listeners.delete(params.onEvent)
          // Não deixa a chave vazia acumulando: um servidor de longa duração com muitos usuários
          // conectando e desconectando vazaria uma entrada por usuário para sempre.
          if (listeners.size === 0) listenersByUser.delete(key)
        },
      }
    },
  }
}
