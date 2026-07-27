import type { MessagePayload } from '../types'
import type { ConversationChannel } from '../conversationChannel'

export interface ConversationsApi {
  fetchMessages(conversationId: string, params?: { limit?: number; before?: string }): Promise<MessagePayload[]>
  fetchConversations(params?: {
    page?: number
    limit?: number
    waitingHuman?: boolean
    search?: string
  }): Promise<ConversationSummary[]>
  sendMessage(conversationId: string, text: string): Promise<MessagePayload>
  sendMedia(
    conversationId: string,
    data: { base64: string; mimeType: string; filename: string; caption?: string },
  ): Promise<MessagePayload>
  sendTemplate(
    conversationId: string,
    data: { templateName: string; languageCode?: string; bodyParams?: string[] },
  ): Promise<void>
  markRead(conversationId: string): Promise<void>
  getContext(conversationId: string): Promise<Record<string, unknown>>
  getDocuments(conversationId: string, params?: { search?: string; page?: number }): Promise<ConversationDocument[]>
  getDocumentUrl(uploadId: string): Promise<string>
  getMediaProxyUrl(mediaId: string): Promise<{ mimeType: string; data: string }>
}

/**
 * Superfície mínima de stream que o pacote consome — exatamente o que `useConversationRealtime`
 * usa: assinar 'message', desassinar e fechar. Deliberadamente estrutural em vez de
 * `EventSource`: sem servidor HTTP não existe `EventSource`, e é isso que impediria alimentar a
 * inbox com dados mockados em desenvolvimento. Um `EventSource` nativo satisfaz este tipo, então
 * quem já implementa `SSEProvider` continua válido sem mudança.
 */
export interface ConversationEventSource {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  close(): void
}

/**
 * Eventos nomeados que o servidor realmente emite (`event: <nome>` no fio). O canal por conversa
 * é `conv:<whatsappNumber>`; o global só emite `data-changed`, como sinal de "refaça a query".
 * Tipar `addEventListener` como `string` em vez de `'message'` existe por isto: quem assina
 * precisa alcançar `message-status` e `mode-changed`, não só `message`.
 */
export const CONVERSATION_STREAM_EVENTS = ['message', 'message-status', 'mode-changed'] as const
export type ConversationStreamEvent = (typeof CONVERSATION_STREAM_EVENTS)[number]

export const GLOBAL_STREAM_EVENTS = ['data-changed'] as const
export type GlobalStreamEvent = (typeof GLOBAL_STREAM_EVENTS)[number]

export interface SSEProvider {
  connectConversationStream(conversationId: string): ConversationEventSource
  connectGlobalStream(): ConversationEventSource
}

export interface ConversationSummary {
  id: string
  /**
   * @deprecated Use `contactId` com `channel`. Mantido obrigatório para não quebrar quem já
   * consome; some quando o segundo canal entrar em produção.
   */
  whatsappNumber: string
  /** Identificador neutro do contato. Ausente = usa `whatsappNumber`. */
  contactId?: string
  /** Ausente = `whatsapp`, o comportamento de antes desta mudança. */
  channel?: ConversationChannel
  clientName?: string
  lastContent?: string
  lastDirection?: 'inbound' | 'outbound'
  lastAt: string
  lastInboundAt: string | null
  mode: 'bot' | 'human'
  assignedUserId: string | null
  waitingHuman: boolean
  unread: number
  currentState: string
}

export interface ConversationDocument {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  source: string
  linkedAt: string
}
