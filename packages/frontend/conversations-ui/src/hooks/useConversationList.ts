import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import type { ConversationSummary } from '../providers/types'

export interface UseConversationListParams {
  page?: number
  limit?: number
  waitingHuman?: boolean
  search?: string
}

export interface UseConversationListResult {
  conversations: ConversationSummary[]
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

  const { data, loading, error, refetch } = useAsyncResource(
    () => api.fetchConversations(params),
    [params?.page, params?.limit, params?.waitingHuman, params?.search],
  )

  return { conversations: data ?? [], loading, error, refetch }
}
