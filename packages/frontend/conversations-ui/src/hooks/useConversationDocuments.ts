import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import type { ConversationDocument } from '../providers/types'

export interface UseConversationDocumentsParams {
  search?: string
  page?: number
}

export interface UseConversationDocumentsResult {
  documents: ConversationDocument[]
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
}

export function useConversationDocuments(
  conversationId: string,
  params?: UseConversationDocumentsParams,
): UseConversationDocumentsResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationDocuments requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  const { data, loading, error, refetch } = useAsyncResource(
    () => api.getDocuments(conversationId, params),
    [conversationId, params?.search, params?.page],
  )

  return { documents: data ?? [], loading, error, refetch }
}
