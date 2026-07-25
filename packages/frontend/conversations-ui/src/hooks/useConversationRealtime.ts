import { useEffect, useRef } from 'react'
import { useConversations } from '../providers/ConversationsProvider'

export type ConversationRealtimeHandler = (event: MessageEvent) => void

// Assina o SSE de uma conversa via a porta SSEProvider injetada no ConversationsProvider —
// o pacote nunca abre a conexão diretamente contra um endpoint fixo. Reconecta ao trocar
// de conversationId e sempre fecha a EventSource anterior no cleanup.
export function useConversationRealtime(
  conversationId: string | undefined,
  onEvent: ConversationRealtimeHandler,
): void {
  const context = useConversations()
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!context || !conversationId) return

    const source = context.sse.connectConversationStream(conversationId)
    const handler = (event: MessageEvent) => onEventRef.current(event)
    source.addEventListener('message', handler)

    return () => {
      source.removeEventListener('message', handler)
      source.close()
    }
  }, [context, conversationId])
}

// Assina o stream global (ex: novas conversas entrando na fila, notificações cross-conversa)
// — mesma porta SSEProvider, sem conversationId.
export function useGlobalRealtime(onEvent: ConversationRealtimeHandler): void {
  const context = useConversations()
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!context) return

    const source = context.sse.connectGlobalStream()
    const handler = (event: MessageEvent) => onEventRef.current(event)
    source.addEventListener('message', handler)

    return () => {
      source.removeEventListener('message', handler)
      source.close()
    }
  }, [context])
}
