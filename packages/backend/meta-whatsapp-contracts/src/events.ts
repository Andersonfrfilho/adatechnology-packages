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
  /**
   * Mídia recebida do cliente, já persistida como mensagem e pronta para ser copiada da Meta para
   * o storage do host — normalmente enfileirando um job.
   *
   * Hook próprio, e não parte do `onMessageReceived`, porque aquele pertence ao fluxo do bot: ele
   * nem é chamado quando a conversa está em atendimento humano, que é exatamente quando o cliente
   * manda documento para o atendente. Ligar ingestão lá perderia esses arquivos em silêncio.
   *
   * A URL de download da Meta expira, então quem implementa deve tratar como trabalho urgente.
   */
  onMediaReceived?: (media: InboundMediaDescriptor) => Promise<void>
  /**
   * Falha ao enviar UM arquivo da biblioteca num nó `send_media`.
   *
   * O erro é entregue aqui em vez de propagado porque um PDF que não subiu não pode travar a
   * conversa num nó automático — o cliente ficaria parado sem nenhuma mensagem. O módulo segue
   * para o próximo arquivo e para o próximo nó; observar e alertar é do host.
   */
  onFlowMediaError?: (error: unknown, details: { flowKey: string; nodeId: string; uploadId: string }) => void
}

export type InboundMediaDescriptor = {
  readonly companyId: string
  readonly messageId: string
  readonly whatsappNumber: string
  /** ID da mídia na Meta — a origem do download, que expira. */
  readonly sourceMediaId: string
  readonly mimeType: string
  readonly filename?: string
}
