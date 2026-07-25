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
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}
