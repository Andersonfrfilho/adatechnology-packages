import type { MessagePayload } from '../types'

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

export interface SSEProvider {
  connectConversationStream(conversationId: string): EventSource
  connectGlobalStream(): EventSource
}

export interface ConversationSummary {
  id: string
  whatsappNumber: string
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
