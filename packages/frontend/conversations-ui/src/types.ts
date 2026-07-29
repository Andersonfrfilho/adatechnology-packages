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

/**
 * Recorte do bloco `interactive` da Meta que a UI precisa para desenhar o menu. Fica solto (e não
 * espelhando o contrato inteiro) porque o que chega do banco é o payload cru já enviado ao
 * WhatsApp: qualquer campo que a UI não conheça é ignorado, nunca causa erro de render.
 */
export interface InteractiveOption {
  id: string
  title: string
  description?: string
}

export interface InteractiveSection {
  title?: string
  rows?: InteractiveOption[]
}

export interface InteractivePayload {
  type?: 'button' | 'list' | string
  header?: { text?: string }
  body?: { text?: string }
  footer?: { text?: string }
  action?: {
    /** Rótulo do botão que abre a lista — só existe em `type: 'list'`. */
    button?: string
    sections?: InteractiveSection[]
    buttons?: { reply?: InteractiveOption }[]
  }
}

/** Como o cliente respondeu a um menu: por botão ou por item de lista. */
export type InteractiveSelection = {
  readonly kind: 'button' | 'list'
  readonly option: InteractiveOption
}

export interface MessagePayload {
  id: string
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'template' | 'interactive'
  /** Payload cru da mensagem. Em `type: 'interactive'`, carrega o menu que o cliente vê. */
  payload?: InteractivePayload | null
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
