// Estado é string opaca (não enum) — a máquina de estados de cada produto evolui de forma
// independente; o módulo nunca conhece os valores possíveis, só os persiste e devolve.
export type SessionState = string
export type SessionMode = 'bot' | 'human'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSender = 'customer' | 'bot' | 'agent'
export type MessageStatus = 'received' | 'sent' | 'delivered' | 'read' | 'failed'

// Extraído de financiamento-imobiliario-bot/apps/api/src/infra/database/schema/
// conversation-sessions.ts e conversation-messages.ts — mesmo shape, sem o acoplamento ao
// Drizzle (o módulo do backend define o schema real; isto é o contrato de dados).
export interface ConversationSession {
  id: string
  companyId: string
  whatsappNumber: string
  currentState: SessionState
  // Posição no grafo de fluxo, null quando a conversa não está dentro de um. Quem dirige o
  // motor é o host (o módulo só interpreta), então ele precisa ler daqui onde a conversa parou
  // — sem isso o host teria de consultar a tabela do módulo por fora do contrato.
  flowKey: string | null
  currentNodeId: string | null
  context: Record<string, unknown>
  mode: SessionMode
  assignedUserId: string | null
  humanRequestedAt: string | null
  lastInboundAt: string | null
  lastAgentReadAt: string | null
  lastActivity: string
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  companyId: string
  whatsappNumber: string
  direction: MessageDirection
  sender: MessageSender
  agentUserId: string | null
  type: string
  content: string | null
  payload: Record<string, unknown> | null
  waMessageId: string | null
  status: MessageStatus | null
  readAt: string | null
  createdAt: string
}

export interface ConversationSummary {
  id: string
  whatsappNumber: string
  clientName?: string
  lastContent?: string
  lastDirection?: MessageDirection
  lastAt: string
  lastInboundAt: string | null
  mode: SessionMode
  assignedUserId: string | null
  waitingHuman: boolean
  unread: number
  currentState: SessionState
}

export interface ListConversationsParams {
  page?: number
  limit?: number
  waitingHuman?: boolean
  search?: string
}

export interface ListMessagesParams {
  limit?: number
  before?: string
}
