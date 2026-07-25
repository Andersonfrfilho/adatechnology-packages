import { useCallback } from 'react'
import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import type { MessagePayload } from '../types'

export interface UseConversationMessagesResult {
  messages: MessagePayload[]
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
  sendMessage: (text: string) => Promise<MessagePayload>
  sendMedia: (data: { base64: string; mimeType: string; filename: string; caption?: string }) => Promise<MessagePayload>
  sendTemplate: (data: { templateName: string; languageCode?: string; bodyParams?: string[] }) => Promise<void>
  markRead: () => Promise<void>
}

// Camada headless: dados + ações de uma conversa, sem nenhuma tela acoplada — o produto
// consome este hook e monta a UI que quiser (ou usa <MessageBubble>/<MessageComposer>
// por cima, como o pacote já oferece). Requer <ConversationsProvider> como ancestral.
export function useConversationMessages(
  conversationId: string,
  params?: { limit?: number; before?: string },
): UseConversationMessagesResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationMessages requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  const { data, loading, error, refetch } = useAsyncResource(
    () => api.fetchMessages(conversationId, params),
    [conversationId, params?.limit, params?.before],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const message = await api.sendMessage(conversationId, text)
      await refetch()
      return message
    },
    [api, conversationId, refetch],
  )

  const sendMedia = useCallback(
    async (mediaData: { base64: string; mimeType: string; filename: string; caption?: string }) => {
      const message = await api.sendMedia(conversationId, mediaData)
      await refetch()
      return message
    },
    [api, conversationId, refetch],
  )

  const sendTemplate = useCallback(
    async (templateData: { templateName: string; languageCode?: string; bodyParams?: string[] }) => {
      await api.sendTemplate(conversationId, templateData)
      await refetch()
    },
    [api, conversationId, refetch],
  )

  const markRead = useCallback(() => api.markRead(conversationId), [api, conversationId])

  return { messages: data ?? [], loading, error, refetch, sendMessage, sendMedia, sendTemplate, markRead }
}
