export interface ConversationsUIConfig {
  apiBaseUrl: string
  theme?: ConversationsTheme
  features?: ConversationsFeatures
}

export interface ConversationsTheme {
  primaryColor?: string
  backgroundColor?: string
  bubbleSent?: string
  bubbleReceived?: string
  textPrimary?: string
  textSecondary?: string
}

export interface ConversationsFeatures {
  audio?: boolean
  documents?: boolean
  emoji?: boolean
  darkMode?: boolean
}

export interface MessagePayload {
  id: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'template'
  content?: string
  caption?: string
  mediaUrl?: string
  base64?: string
  uploadId?: string
  mediaId?: string
  mimeType?: string
  filename?: string
  sizeBytes?: number
  direction: 'inbound' | 'outbound'
  sender: 'bot' | 'customer' | 'agent'
  timestamp: string
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  readAt?: string
  agentName?: string | null
  templateName?: string
  /**
   * Veredito de moderação vindo do backend — a UI só exibe, nunca calcula. Dicionário no browser
   * seria peso morto e daria veredito diferente por versão de cliente.
   *
   * `null`/ausente = não avaliado (moderação desligada, ou mensagem anterior ao recurso), que é
   * diferente de avaliado e limpo.
   */
  moderation?: { isOffensive: boolean; terms: string[] } | null
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}
