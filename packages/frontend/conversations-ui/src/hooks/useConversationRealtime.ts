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
  const sse = useConversations()?.sse
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // Depende da porta SSE, não do objeto de contexto inteiro: reabrir o stream é caro (um ticket por
  // abertura) e o contexto é o que mais muda de identidade quando o host renderiza.
  useEffect(() => {
    if (!sse || !conversationId) return

    const source = sse.connectConversationStream(conversationId)
    const handler = (event: MessageEvent) => onEventRef.current(event)
    source.addEventListener('message', handler)

    return () => {
      source.removeEventListener('message', handler)
      source.close()
    }
  }, [sse, conversationId])
}

// Assina o stream global (ex: novas conversas entrando na fila, notificações cross-conversa)
// — mesma porta SSEProvider, sem conversationId.
export function useGlobalRealtime(onEvent: ConversationRealtimeHandler): void {
  const sse = useConversations()?.sse
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!sse) return

    const source = sse.connectGlobalStream()
    const handler = (event: MessageEvent) => onEventRef.current(event)
    source.addEventListener('message', handler)

    return () => {
      source.removeEventListener('message', handler)
      source.close()
    }
  }, [sse])
}
