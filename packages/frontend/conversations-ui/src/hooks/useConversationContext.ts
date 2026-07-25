import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'

export interface UseConversationContextResult {
  context: Record<string, unknown> | undefined
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
}

// Dados de contexto da conversa (variáveis coletadas no fluxo) — o produto decide como
// exibir (ex: <SelectionsSummary> no bot, ou uma UI própria).
export function useConversationContext(conversationId: string): UseConversationContextResult {
  const conversationsContext = useConversations()
  if (!conversationsContext) {
    throw new Error('useConversationContext requires an ancestor <ConversationsProvider>')
  }
  const { api } = conversationsContext

  const { data, loading, error, refetch } = useAsyncResource(() => api.getContext(conversationId), [conversationId])

  return { context: data, loading, error, refetch }
}
