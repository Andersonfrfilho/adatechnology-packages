/**
 * `EventSource` só existe com um servidor HTTP do outro lado — é justamente o que falta quando se
 * quer a inbox rodando com dados mockados. Este é o objeto mínimo que satisfaz
 * `ConversationEventSource`: assina eventos nomeados, desassina e fecha.
 *
 * Não imita `EventSource` por completo de propósito: um fake "quase real" convida a depender de
 * membros que o pacote não usa, e passa a quebrar a cada mudança de runtime.
 */

import type { ConversationEventSource } from '../providers/types'

export type MockEventSource = ConversationEventSource & {
  emit(event: string, payload: unknown): void
  readonly closed: boolean
}

export function createMockEventSource(): MockEventSource {
  const listeners = new Map<string, Set<(event: MessageEvent) => void>>()
  let closed = false

  return {
    get closed(): boolean {
      return closed
    },

    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
      const typeListeners = listeners.get(type) ?? new Set<(event: MessageEvent) => void>()
      typeListeners.add(listener)
      listeners.set(type, typeListeners)
    },

    removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
      listeners.get(type)?.delete(listener)
    },

    close(): void {
      closed = true
      listeners.clear()
    },

    emit(event: string, payload: unknown): void {
      // Depois de fechado, emitir é no-op: o servidor real também não entrega em socket fechado, e
      // silenciar aqui é o que faz vazamento de listener aparecer como bug de cleanup, não como
      // evento fantasma na UI.
      if (closed) return

      // `data` é string no fio; entregar o objeto já parseado esconderia erro de serialização que
      // aparece em produção.
      const messageEvent = new MessageEvent(event, { data: JSON.stringify(payload) })
      for (const listener of listeners.get(event) ?? []) listener(messageEvent)
    },
  }
}
