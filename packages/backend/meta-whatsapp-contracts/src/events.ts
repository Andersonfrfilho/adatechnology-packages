import type {
  WhatsAppMessage,
  WhatsAppPhoneNumberQualityUpdate,
  WhatsAppStatus,
  WhatsAppTemplateStatusUpdate,
} from './webhook.types'
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
/** O que se sabe de quem mandou a mensagem, além do número. */
export type InboundContact = {
  /** Nome que a pessoa escolheu no WhatsApp dela. Ausente quando ela não definiu um. */
  readonly profileName?: string
}

export interface MetaWhatsAppHooks {
  /**
   * `contact` traz o nome de perfil de quem mandou, quando a Meta o envia. Terceiro parâmetro e
   * opcional para não quebrar host que já implementa o hook com dois — quem não usa, ignora.
   */
  onMessageReceived?: (
    message: WhatsAppMessage,
    session: ConversationSession,
    contact?: InboundContact,
  ) => Promise<MessageHookOutcome>
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
  /**
   * Falha ao enviar a vitrine de produtos num nó `send_product_list`.
   *
   * Hook próprio, e não o de mídia: aqui não há `uploadId` — o que falhou foi a montagem da
   * vitrine a partir do catálogo, e o host precisa saber qual nó ficou mudo.
   */
  onFlowProductListError?: (error: unknown, details: { flowKey: string; nodeId: string }) => void
  /**
   * Transcrição de áudio falhou de forma **retriável** (cota estourada, rede, 5xx) — o áudio segue
   * transcritível e alguém precisa tentar de novo.
   *
   * É hook, e não exceção propagada, porque a mídia JÁ foi copiada para o storage quando isto
   * acontece: deixar o erro subir marcaria a ingestão inteira como falha e o job reprocessaria o
   * download de um binário que está salvo. E é hook, e não retentativa interna, porque o módulo não
   * tem fila — quem sabe reenfileirar com atraso é o host, que já tem uma.
   *
   * Sem implementar, o áudio fica com `transcription_status = 'pending'` e nada o retoma: a
   * transcrição não se perde nem mente, mas só sai se pedirem sob demanda.
   */
  onTranscriptionDeferred?: (details: TranscriptionDeferredDescriptor) => Promise<void> | void
  /**
   * A Meta mudou o status de um template (aprovado, rejeitado, pausado).
   *
   * É um evento de conta, não de conversa: não tem `session` nem número de cliente, e chega mesmo
   * quando nenhuma conversa está acontecendo. Sem implementar, a única forma de descobrir que um
   * template foi rejeitado é alguém abrir o painel da Meta e reparar.
   */
  onTemplateStatusUpdate?: (update: WhatsAppTemplateStatusUpdate) => Promise<void> | void
  /**
   * Qualidade ou limite de envio do número mudou (`FLAGGED` = qualidade caiu e o número corre risco
   * de restrição; `DOWNGRADE` = teto de envio reduzido).
   *
   * Vale tratar como alerta operacional: quando vira restrição de fato, as mensagens já estão
   * falhando, e o histórico de qualidade que explicaria a queda tem retenção curta no painel.
   */
  onPhoneNumberQualityUpdate?: (update: WhatsAppPhoneNumberQualityUpdate) => Promise<void> | void
  /**
   * Chegou um `field` que este módulo não sabe tratar — ou um que sabe, mas com corpo fora do
   * schema (versão nova da Cloud API, campo assinado sem handler).
   *
   * Existe para que o webhook nunca seja um buraco negro: descartar em silêncio é indistinguível de
   * webhook que parou de chegar, e foi assim que os eventos de template ficaram invisíveis até
   * alguém procurar. Observar aqui é do host; o módulo não decide que é erro.
   */
  onUnhandledWebhookEvent?: (details: UnhandledWebhookEventDescriptor) => Promise<void> | void
}

export type UnhandledWebhookEventDescriptor = {
  /** O `changes[].field` como a Meta mandou; `undefined` quando o payload nem trouxe o campo. */
  readonly field: string | undefined
  /** Por que não foi tratado: sem handler para o field, ou corpo que não bate com o schema dele. */
  readonly reason: 'unknown-field' | 'invalid-shape'
  /** O `value` cru, para diagnóstico. Nunca logar inteiro: pode conter dado de cliente. */
  readonly value: unknown
}

export type TranscriptionDeferredDescriptor = {
  readonly companyId: string
  readonly messageId: string
  readonly whatsappNumber: string
  /** Onde o áudio já está salvo — quem retomar lê daqui, não da Meta (cuja URL expira). */
  readonly uploadId: string
  /** Do `Retry-After` do engine, quando informado. É o intervalo mínimo a respeitar. */
  readonly retryAfterSeconds?: number
  readonly reason: 'rate-limited' | 'transient-failure'
  readonly error: unknown
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
