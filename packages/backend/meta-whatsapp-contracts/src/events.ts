import type { WhatsAppMessage, WhatsAppStatus } from './webhook.types'
import type { ConversationSession } from './conversation.types'

export type MessageHookOutcome = { outcome: 'handled' } | { outcome: 'continue' }

// Ganchos de extensão do host — é aqui, e só aqui, que a regra de negócio do produto entra
// (ver rules/packages/pluggable-module.md, "as únicas portas permitidas"). O módulo nunca decide
// sozinho o que fazer com uma mensagem; ele delega e respeita o outcome devolvido.
//
// 'handled': o host já respondeu/tratou a mensagem — o módulo não segue com seu próprio
//   processamento padrão (ex.: não encaminha para o interpretador de fluxo).
// 'continue': o host apenas observou — o módulo segue com o fluxo normal (motor de fluxo, se
//   `features.flowEngine` estiver ligado).
export interface MetaWhatsAppHooks {
  onMessageReceived?: (message: WhatsAppMessage, session: ConversationSession) => Promise<MessageHookOutcome>
  onStatusUpdate?: (status: WhatsAppStatus, session: ConversationSession | null) => Promise<void>
  onSessionExpired?: (session: ConversationSession) => Promise<void>
  // Disparado quando um handoff humano é solicitado (cliente pediu atendente, ou o fluxo decidiu
  // encaminhar) — o host decide como notificar (fila, Slack, etc.); o módulo só marca o estado.
  onHumanRequested?: (session: ConversationSession) => Promise<void>
}
