import { useMemo } from 'react'
import { useConversations } from '../providers/ConversationsProvider'
import type { ConversationTemplate } from '../providers/types'

export interface UseConversationActionsResult {
  /** `undefined` quando a API do host não implementa a operação — a UI esconde a afordância. */
  takeover: (() => Promise<void>) | undefined
  release: (() => Promise<void>) | undefined
  finalize: (() => Promise<void>) | undefined
}

/**
 * Ações de atendimento de UMA conversa, já ligadas ao id.
 *
 * Separado de `useConversationMessages` porque assumir e devolver conversa também acontece a
 * partir da lista, onde nenhuma thread está aberta — embutir nas mensagens obrigaria a carregar
 * a thread inteira só para desenhar um botão na linha.
 */
export function useConversationActions(conversationId: string): UseConversationActionsResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useConversationActions requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  return useMemo(
    () => ({
      takeover: api.takeover ? () => api.takeover!(conversationId) : undefined,
      release: api.release ? () => api.release!(conversationId) : undefined,
      finalize: api.finalize ? () => api.finalize!(conversationId) : undefined,
    }),
    [api, conversationId],
  )
}

export interface UseInboxActionsResult {
  markAllRead: (() => Promise<void>) | undefined
  listTemplates: (() => Promise<ConversationTemplate[]>) | undefined
}

/** Ações que valem para a caixa inteira, sem conversa selecionada. */
export function useInboxActions(): UseInboxActionsResult {
  const context = useConversations()
  if (!context) {
    throw new Error('useInboxActions requires an ancestor <ConversationsProvider>')
  }
  const { api } = context

  return useMemo(
    () => ({
      markAllRead: api.markAllRead ? () => api.markAllRead!() : undefined,
      listTemplates: api.listTemplates ? () => api.listTemplates!() : undefined,
    }),
    [api],
  )
}
