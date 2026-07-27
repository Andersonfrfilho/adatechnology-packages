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

// Aceita `undefined` como "ainda não buscar", igual a `useConversationRealtime`: a lista de anexos
// é consulta extra, e quem só abre o painel sob demanda não deve pagar por ela em toda conversa.
export function useConversationDocuments(
  conversationId: string | undefined,
  params?: UseConversationDocumentsParams,
): UseConversationDocumentsResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationDocuments requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  const { data, loading, error, refetch } = useAsyncResource(
    () => (conversationId ? api.getDocuments(conversationId, params) : Promise.resolve([])),
    [conversationId, params?.search, params?.page],
  )

  return { documents: data ?? [], loading, error, refetch }
}
