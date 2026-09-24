import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConversations } from '../providers/ConversationsProvider'
import { useAsyncResource } from './useAsyncResource'
import type { MessagePayload } from '../types'

/** Tamanho da página ao buscar mensagens anteriores — mesmo padrão do `before` sem `limit`. */
const OLDER_MESSAGES_PAGE_LIMIT = 50

export interface UseConversationMessagesResult {
  messages: MessagePayload[]
  loading: boolean
  error: Error | undefined
  refetch: () => Promise<void>
  sendMessage: (text: string) => Promise<MessagePayload>
  sendMedia: (data: { base64: string; mimeType: string; filename: string; caption?: string }) => Promise<MessagePayload>
  sendTemplate: (data: { templateName?: string; languageCode?: string; bodyParams?: string[] }) => Promise<void>
  markRead: () => Promise<void>
  /** Busca a página anterior de mensagens e prepende ao histórico já carregado. */
  loadOlderMessages: () => Promise<void>
  loadingOlderMessages: boolean
  /** `false` assim que uma página vier menor que o limite — não há mais o que buscar antes dela. */
  hasMoreOlderMessages: boolean
}

/** Descarta qualquer mensagem cujo `id` já apareceu antes, mantendo a primeira ocorrência. */
export function dedupeMessagesById(messages: readonly MessagePayload[]): MessagePayload[] {
  const seenIds = new Set<string>()
  const deduped: MessagePayload[] = []
  for (const message of messages) {
    if (seenIds.has(message.id)) continue
    seenIds.add(message.id)
    deduped.push(message)
  }
  return deduped
}

/**
 * Soma uma página de mensagens antigas ao acumulado já carregado, sem duplicar.
 *
 * Duplicar aconteceria numa corrida onde a mesma página chegasse duas vezes — o `id` é a única
 * garantia de identidade da mensagem, o timestamp usado no `before` não basta sozinho.
 */
export function prependOlderMessages(
  accumulated: readonly MessagePayload[],
  olderPage: readonly MessagePayload[],
): MessagePayload[] {
  const existingIds = new Set(accumulated.map((message) => message.id))
  const newMessages = olderPage.filter((message) => !existingIds.has(message.id))
  return [...newMessages, ...accumulated]
}

export type LoadOlderMessagesGuardState = {
  readonly isLoading: boolean
  readonly hasMore: boolean
  readonly oldestMessage: MessagePayload | undefined
}

/**
 * Decide se vale a pena buscar a página anterior: nunca com uma busca já em voo (evita requisição
 * concorrente), nunca depois que uma página já veio incompleta, e nunca sem uma mensagem mais
 * antiga para servir de `before`.
 */
export function shouldFetchOlderMessages(state: LoadOlderMessagesGuardState): boolean {
  if (state.isLoading || !state.hasMore) return false
  return Boolean(state.oldestMessage)
}

/** A página veio menor que o limite pedido: não há mais nada antes dela para buscar. */
export function pageIndicatesMoreOlderMessages(pageLength: number, limit: number): boolean {
  return pageLength >= limit
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

  const [olderMessages, setOlderMessages] = useState<MessagePayload[]>([])
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  /**
   * Espelha `loadingOlderMessages`: o guarda de concorrência precisa ler o valor atual na hora do
   * clique/scroll, e o estado do React só reflete depois do próximo render.
   */
  const loadingOlderMessagesRef = useRef(false)

  // Trocar de conversa zera a paginação de mensagens antigas — a anterior podia já ter esgotado o
  // histórico, e isso não pode vazar para a conversa que acabou de abrir.
  useEffect(() => {
    setOlderMessages([])
    setHasMoreOlderMessages(true)
  }, [conversationId])

  const messages = useMemo(() => dedupeMessagesById([...olderMessages, ...(data ?? [])]), [olderMessages, data])

  const loadOlderMessages = useCallback(async () => {
    const oldestMessage = messages[0]
    if (
      !shouldFetchOlderMessages({
        isLoading: loadingOlderMessagesRef.current,
        hasMore: hasMoreOlderMessages,
        oldestMessage,
      })
    )
      return
    // `shouldFetchOlderMessages` já garante isto — repetido aqui só para o compilador estreitar o tipo.
    if (!oldestMessage) return

    loadingOlderMessagesRef.current = true
    setLoadingOlderMessages(true)
    try {
      const olderPage = await api.fetchMessages(conversationId, {
        limit: OLDER_MESSAGES_PAGE_LIMIT,
        before: oldestMessage.timestamp,
      })
      if (!pageIndicatesMoreOlderMessages(olderPage.length, OLDER_MESSAGES_PAGE_LIMIT)) setHasMoreOlderMessages(false)
      setOlderMessages((current) => prependOlderMessages(current, olderPage))
    } finally {
      loadingOlderMessagesRef.current = false
      setLoadingOlderMessages(false)
    }
  }, [api, conversationId, hasMoreOlderMessages, messages])

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
    async (templateData: { templateName?: string; languageCode?: string; bodyParams?: string[] }) => {
      await api.sendTemplate(conversationId, templateData)
      await refetch()
    },
    [api, conversationId, refetch],
  )

  const markRead = useCallback(() => api.markRead(conversationId), [api, conversationId])

  return {
    messages,
    loading,
    error,
    refetch,
    sendMessage,
    sendMedia,
    sendTemplate,
    markRead,
    loadOlderMessages,
    loadingOlderMessages,
    hasMoreOlderMessages,
  }
}
