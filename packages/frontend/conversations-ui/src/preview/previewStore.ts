/**
 * Estado em memória que alimenta o preview de atendimento humano. Mock de API e mock de SSE
 * compartilham este store de propósito: se cada um tivesse dados próprios, um evento anunciaria
 * mensagem nova e o refetch da lista devolveria o estado antigo — a inbox pareceria funcionar e
 * estaria mentindo, que é exatamente o defeito que o preview deveria expor.
 *
 * Os nomes de canal e de evento espelham o servidor (`conv:<whatsappNumber>`, `global`,
 * `message`/`message-status`/`mode-changed`/`data-changed`). Fidelidade de vocabulário é o que
 * permite trocar mock por servidor real sem tocar na UI.
 */

import type { MessagePayload } from '../types'
import type { ConversationSummary } from '../providers/types'

export const GLOBAL_CHANNEL = 'global'

export function conversationChannel(conversationId: string): string {
  return `conv:${conversationId}`
}

export type PreviewEmission = {
  readonly channel: string
  readonly event: string
  readonly payload: Record<string, unknown>
}

export type PreviewStoreListener = (emission: PreviewEmission) => void

export type AppendMessageParams = {
  readonly conversationId: string
  readonly content: string
  readonly direction: MessagePayload['direction']
  readonly sender: MessagePayload['sender']
}

export type SetModeParams = {
  readonly conversationId: string
  readonly mode: ConversationSummary['mode']
  readonly assignedUserId?: string | undefined
}

export type ListConversationsFilters = {
  readonly waitingHuman?: boolean
  readonly search?: string
}

export type PreviewStore = {
  listConversations(filters?: ListConversationsFilters): ConversationSummary[]
  listMessages(conversationId: string): MessagePayload[]
  appendMessage(params: AppendMessageParams): MessagePayload
  setMode(params: SetModeParams): void
  requestHuman(conversationId: string): void
  markRead(conversationId: string): void
  subscribe(channel: string, listener: PreviewStoreListener): () => void
}

export type CreatePreviewStoreParams = {
  readonly conversations: readonly ConversationSummary[]
  readonly messages: Readonly<Record<string, readonly MessagePayload[]>>
  // Injetável para o teste conseguir asserir timestamps sem depender do relógio.
  readonly now?: () => Date
}

export function createPreviewStore(params: CreatePreviewStoreParams): PreviewStore {
  const conversations = params.conversations.map((conversation) => ({ ...conversation }))
  const messages = new Map<string, MessagePayload[]>(
    Object.entries(params.messages).map(([conversationId, list]) => [conversationId, [...list]]),
  )
  const listeners = new Map<string, Set<PreviewStoreListener>>()
  const now = params.now ?? ((): Date => new Date())

  let messageSequence = 0

  function emit(emission: PreviewEmission): void {
    for (const listener of listeners.get(emission.channel) ?? []) listener(emission)
  }

  // Toda mutação avisa o canal global: é o sinal de "refaça a query" que mantém a lista coerente
  // com o que o canal da conversa acabou de anunciar.
  function emitDataChanged(): void {
    emit({ channel: GLOBAL_CHANNEL, event: 'data-changed', payload: {} })
  }

  function findConversation(conversationId: string): ConversationSummary | undefined {
    return conversations.find((conversation) => conversation.id === conversationId)
  }

  return {
    listConversations(filters?: ListConversationsFilters): ConversationSummary[] {
      return conversations
        .filter((conversation) => (filters?.waitingHuman ? conversation.waitingHuman : true))
        .filter((conversation) => {
          const search = filters?.search?.toLowerCase()
          if (!search) return true
          return (
            conversation.whatsappNumber.includes(search) ||
            (conversation.clientName?.toLowerCase().includes(search) ?? false)
          )
        })
        .map((conversation) => ({ ...conversation }))
        .sort((left, right) => right.lastAt.localeCompare(left.lastAt))
    },

    listMessages(conversationId: string): MessagePayload[] {
      return [...(messages.get(conversationId) ?? [])]
    },

    appendMessage(appendParams: AppendMessageParams): MessagePayload {
      messageSequence += 1
      const timestamp = now().toISOString()
      const message: MessagePayload = {
        id: `preview-${messageSequence}`,
        type: 'text',
        content: appendParams.content,
        direction: appendParams.direction,
        sender: appendParams.sender,
        timestamp,
        status: appendParams.direction === 'outbound' ? 'sent' : undefined,
      }

      const conversationMessages = messages.get(appendParams.conversationId) ?? []
      messages.set(appendParams.conversationId, [...conversationMessages, message])

      const conversation = findConversation(appendParams.conversationId)
      if (conversation) {
        conversation.lastContent = appendParams.content
        conversation.lastDirection = appendParams.direction
        conversation.lastAt = timestamp
        if (appendParams.direction === 'inbound') {
          conversation.lastInboundAt = timestamp
          conversation.unread += 1
        }
      }

      // O servidor emite APENAS `{ direction, sender }` neste evento — é ping de "refaça a
      // query", não entrega de dados. Emitir a mensagem inteira aqui deixaria o mock mais
      // generoso que a realidade, e uma UI que lesse `event.data.content` funcionaria no preview
      // e quebraria em produção.
      emit({
        channel: conversationChannel(appendParams.conversationId),
        event: 'message',
        payload: { direction: message.direction, sender: message.sender },
      })
      emitDataChanged()

      return message
    },

    setMode(modeParams: SetModeParams): void {
      const conversation = findConversation(modeParams.conversationId)
      if (!conversation) return

      conversation.mode = modeParams.mode
      conversation.assignedUserId = modeParams.assignedUserId ?? null
      // Assumir a conversa é o que atende ao pedido de humano — deixar a flag acesa manteria a
      // conversa na fila de espera para sempre.
      if (modeParams.mode === 'human') conversation.waitingHuman = false

      emit({
        channel: conversationChannel(modeParams.conversationId),
        event: 'mode-changed',
        payload: { mode: conversation.mode, assignedUserId: conversation.assignedUserId },
      })
      emitDataChanged()
    },

    requestHuman(conversationId: string): void {
      const conversation = findConversation(conversationId)
      if (!conversation) return

      conversation.waitingHuman = true
      emitDataChanged()
    },

    markRead(conversationId: string): void {
      const conversation = findConversation(conversationId)
      if (!conversation) return

      conversation.unread = 0
      emitDataChanged()
    },

    subscribe(channel: string, listener: PreviewStoreListener): () => void {
      const channelListeners = listeners.get(channel) ?? new Set<PreviewStoreListener>()
      channelListeners.add(listener)
      listeners.set(channel, channelListeners)

      return () => {
        channelListeners.delete(listener)
      }
    },
  }
}
