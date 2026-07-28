import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import { documentsOf, totalOf } from '../lib/paginated'
import type { ConversationDocument, ListDocumentsParams } from '../providers/types'

export type UseConversationDocumentsParams = ListDocumentsParams

export interface UseConversationDocumentsResult {
  documents: ConversationDocument[]
  /** Total no servidor. Cai para o tamanho da página quando a API devolve só o array. */
  total: number
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
    [conversationId, params?.search, params?.page, params?.limit, params?.source, params?.sortDirection],
  )

  if (data === undefined) {
    return { documents: [], total: 0, loading, error, refetch }
  }

  return { documents: documentsOf(data), total: totalOf(data), loading, error, refetch }
}
