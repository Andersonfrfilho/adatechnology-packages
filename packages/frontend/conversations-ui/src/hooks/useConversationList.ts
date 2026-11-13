import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import { conversationsOf, totalOf } from '../lib/paginated'
import type { ConversationSummary, ListConversationsParams } from '../providers/types'

export type UseConversationListParams = ListConversationsParams

export interface UseConversationListResult {
  conversations: ConversationSummary[]
  /** Total no servidor. Cai para o tamanho da página quando a API devolve só o array. */
  total: number
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
}

export function useConversationList(params?: UseConversationListParams): UseConversationListResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationList requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  // `filters` é objeto novo a cada render do host; serializar evita refetch em laço sem obrigar
  // o consumidor a memoizar — omissão que só apareceria como loop de rede em produção.
  const filtersKey = JSON.stringify(params?.filters ?? {})

  const { data, loading, error, refetch } = useAsyncResource(
    () => api.fetchConversations(params),
    [params?.page, params?.limit, params?.waitingHuman, params?.search, filtersKey],
  )

  if (data === undefined) {
    return { conversations: [], total: 0, loading, error, refetch }
  }

  return { conversations: conversationsOf(data), total: totalOf(data), loading, error, refetch }
}
