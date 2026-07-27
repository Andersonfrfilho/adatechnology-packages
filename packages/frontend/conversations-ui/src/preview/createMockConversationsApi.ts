/**
 * `ConversationsApi` servido pelo store em memória. Como o pacote é headless e recebe a API por
 * injeção, o preview de atendimento humano não precisa de servidor, banco nem Meta: é só outra
 * implementação deste mesmo contrato.
 *
 * Toda resposta é assíncrona e passa por um atraso configurável — API instantânea esconde estados
 * de carregamento, e é neles que a inbox costuma mostrar defeito.
 */

import type { MessagePayload } from '../types'
import type { ConversationDocument, ConversationsApi, ConversationSummary } from '../providers/types'
import type { PreviewStore } from './previewStore'

// PNG 1x1 transparente: o suficiente para o MediaRenderer ter algo válido para desenhar.
const PREVIEW_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAX+XyEgAAAABJRU5ErkJggg=='

export type CreateMockConversationsApiParams = {
  readonly store: PreviewStore
  readonly latencyMs?: number
  readonly agentName?: string
}

const DEFAULT_LATENCY_MS = 120

export function createMockConversationsApi(params: CreateMockConversationsApiParams): ConversationsApi {
  const latencyMs = params.latencyMs ?? DEFAULT_LATENCY_MS

  async function withLatency<TResult>(produce: () => TResult): Promise<TResult> {
    await new Promise((resolve) => setTimeout(resolve, latencyMs))
    return produce()
  }

  return {
    fetchConversations(fetchParams): Promise<ConversationSummary[]> {
      return withLatency(() => {
        const conversations = params.store.listConversations({
          waitingHuman: fetchParams?.waitingHuman,
          search: fetchParams?.search,
        })

        const limit = fetchParams?.limit ?? conversations.length
        const page = fetchParams?.page ?? 1
        return conversations.slice((page - 1) * limit, page * limit)
      })
    },

    fetchMessages(conversationId, fetchParams): Promise<MessagePayload[]> {
      return withLatency(() => {
        const messages = params.store.listMessages(conversationId)
        const limit = fetchParams?.limit
        return limit ? messages.slice(-limit) : messages
      })
    },

    sendMessage(conversationId, text): Promise<MessagePayload> {
      return withLatency(() =>
        params.store.appendMessage({ conversationId, content: text, direction: 'outbound', sender: 'agent' }),
      )
    },

    sendMedia(conversationId, data): Promise<MessagePayload> {
      return withLatency(() =>
        params.store.appendMessage({
          conversationId,
          content: data.caption ?? data.filename,
          direction: 'outbound',
          sender: 'agent',
        }),
      )
    },

    sendTemplate(conversationId, data): Promise<void> {
      return withLatency(() => {
        params.store.appendMessage({
          conversationId,
          content: `[template] ${data.templateName}`,
          direction: 'outbound',
          sender: 'agent',
        })
      })
    },

    markRead(conversationId): Promise<void> {
      return withLatency(() => params.store.markRead(conversationId))
    },

    getContext(conversationId): Promise<Record<string, unknown>> {
      return withLatency(() => {
        const conversation = params.store.listConversations().find((item) => item.id === conversationId)
        return {
          currentState: conversation?.currentState ?? 'unknown',
          mode: conversation?.mode ?? 'bot',
          preview: true,
        }
      })
    },

    getDocuments(): Promise<ConversationDocument[]> {
      return withLatency(() => [])
    },

    getDocumentUrl(): Promise<string> {
      return withLatency(() => `data:image/png;base64,${PREVIEW_IMAGE_BASE64}`)
    },

    getMediaProxyUrl(): Promise<{ mimeType: string; data: string }> {
      return withLatency(() => ({ mimeType: 'image/png', data: PREVIEW_IMAGE_BASE64 }))
    },
  }
}
