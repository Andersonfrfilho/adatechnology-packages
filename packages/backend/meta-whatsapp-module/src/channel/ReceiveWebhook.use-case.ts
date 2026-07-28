import {
  whatsAppWebhookPayloadSchema,
  type MetaWhatsAppHooks,
  type SessionState,
  type WhatsAppMessage,
  type WhatsAppStatus,
  type MessageStatus,
  type ConversationSession,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRow } from '../schema/schema'
import { verifyWebhookSignature, claimWebhookDelivery, type NonceStoreInterface } from './webhookSecurity'
import { extractMediaDescriptor } from './IngestInboundMedia.use-case'

export type ReceiveWebhookParams = {
  companyId: string
  rawBody: Buffer | string
  signatureHeader: string | null | undefined
}

export type ReceiveWebhookResult = {
  // Sempre 200 para a Meta, mesmo em duplicata — ela desativa webhooks que respondem erro.
  duplicate: boolean
  messagesProcessed: number
  statusesProcessed: number
}

function toSessionContract(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    companyId: row.companyId,
    whatsappNumber: row.whatsappNumber,
    currentState: row.currentState,
    flowKey: row.flowKey,
    currentNodeId: row.currentNodeId,
    context: row.context,
    mode: row.mode as ConversationSession['mode'],
    assignedUserId: row.assignedUserId,
    humanRequestedAt: row.humanRequestedAt?.toISOString() ?? null,
    lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
    lastAgentReadAt: row.lastAgentReadAt?.toISOString() ?? null,
    lastActivity: row.lastActivity.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// Texto legível para o transcript. Uma mensagem interativa traz título E id; guardamos o título
// (é o que o cliente viu), com o id como fallback quando a Meta não manda título.
function extractContent(message: WhatsAppMessage): string | null {
  if (message.text?.body) return message.text.body
  const interactive = message.interactive
  if (interactive?.button_reply) return interactive.button_reply.title || interactive.button_reply.id
  if (interactive?.list_reply) return interactive.list_reply.title || interactive.list_reply.id
  if (message.order) {
    const items = message.order.product_items.reduce((sum, item) => sum + item.quantity, 0)
    return `Pedido: ${items} item(ns)`
  }
  return message.image?.caption ?? message.document?.caption ?? null
}

// A resposta que o motor de fluxo deve consumir: para interativo é o ID da opção (estável), não
// o título (que muda quando alguém edita o texto do botão no editor).
function extractAnswer(message: WhatsAppMessage): string | undefined {
  const interactive = message.interactive
  if (interactive?.button_reply) return interactive.button_reply.id
  if (interactive?.list_reply) return interactive.list_reply.id
  return message.text?.body
}

function extractPayload(message: WhatsAppMessage): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {}
  if (message.interactive) payload['interactive'] = message.interactive
  if (message.order) payload['order'] = message.order
  if (message.image) payload['image'] = message.image
  if (message.audio) payload['audio'] = message.audio
  if (message.video) payload['video'] = message.video
  if (message.document) payload['document'] = message.document
  if (message.sticker) payload['sticker'] = message.sticker
  if (message.context?.referred_product) payload['referredProduct'] = message.context.referred_product
  return Object.keys(payload).length > 0 ? payload : null
}

// T5.1 — porta de entrada do canal. Ordem deliberada: assinatura → anti-replay → parse → efeito.
// Verificar a assinatura antes de qualquer parse evita gastar CPU (e superfície do zod) com
// corpo não autenticado.
export class ReceiveWebhookUseCase {
  constructor(
    private readonly params: {
      appSecret: string
      nonceStore: NonceStoreInterface
      sessionRepository: SessionRepository
      messageRepository: MessageRepository
      logMessage: LogMessageUseCase
      startState: SessionState
      hooks?: MetaWhatsAppHooks
      realtime?: RealtimeNotifierInterface
    },
  ) {}

  async execute(input: ReceiveWebhookParams): Promise<ReceiveWebhookResult> {
    verifyWebhookSignature({
      rawBody: input.rawBody,
      signatureHeader: input.signatureHeader,
      appSecret: this.params.appSecret,
    })

    const claimed = await claimWebhookDelivery({
      nonceStore: this.params.nonceStore,
      signatureHeader: input.signatureHeader!,
    })
    if (!claimed) return { duplicate: true, messagesProcessed: 0, statusesProcessed: 0 }

    const rawText = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8')
    const payload = whatsAppWebhookPayloadSchema.parse(JSON.parse(rawText))

    let messagesProcessed = 0
    let statusesProcessed = 0

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        for (const message of change.value.messages ?? []) {
          await this.handleMessage(input.companyId, message)
          messagesProcessed++
        }
        for (const status of change.value.statuses ?? []) {
          await this.handleStatus(input.companyId, status)
          statusesProcessed++
        }
      }
    }

    return { duplicate: false, messagesProcessed, statusesProcessed }
  }

  private async handleMessage(companyId: string, message: WhatsAppMessage): Promise<void> {
    const saved = await this.params.logMessage.execute({
      companyId,
      whatsappNumber: message.from,
      direction: 'inbound',
      sender: 'customer',
      type: message.type,
      content: extractContent(message),
      payload: extractPayload(message),
      waMessageId: message.id,
      status: 'received',
      startState: this.params.startState,
    })
    // Mensagem repetida (mesmo waMessageId já gravado): não dispara o hook de novo, senão a
    // regra de negócio do host rodaria duas vezes para a mesma mensagem do cliente.
    if (!saved) return

    // Antes de qualquer retorno antecipado: os `return` abaixo (atendimento humano, sessão ausente)
    // são sobre o FLUXO DO BOT, e mídia precisa ser copiada da Meta de qualquer forma. Justamente em
    // atendimento humano é que o cliente manda documento para o atendente — deixar a ingestão
    // depois desse `return` perderia esses arquivos, e a URL da Meta expira sem segunda chance.
    const media = extractMediaDescriptor(saved)
    if (media) {
      await this.params.hooks?.onMediaReceived?.({
        companyId,
        messageId: saved.id,
        whatsappNumber: message.from,
        sourceMediaId: media.sourceMediaId,
        mimeType: media.mimeType,
        ...(media.filename ? { filename: media.filename } : {}),
      })
    }

    const sessionRow = await this.params.sessionRepository.getContext(companyId, message.from)
    if (!sessionRow) return

    // Conversa em atendimento humano não é processada pelo bot — o atendente responde.
    if (sessionRow.mode === 'human') return

    const outcome = await this.params.hooks?.onMessageReceived?.(message, toSessionContract(sessionRow))
    // 'handled' = o host já respondeu e assumiu a mensagem; o módulo não segue com o fluxo.
    if (outcome?.outcome === 'handled') return

    // 'continue' (ou sem hook): quem dirige o motor de fluxo é o host via runFlowStep — o
    // webhook só entrega o sinal. Expor a resposta extraída evita que cada host reimplemente
    // a lógica de "qual é a resposta do cliente" para interativo vs texto.
    void extractAnswer(message)
  }

  private async handleStatus(companyId: string, status: WhatsAppStatus): Promise<void> {
    const updated = await this.params.messageRepository.updateMessageStatus(
      companyId,
      status.id,
      status.status as MessageStatus,
    )
    if (!updated) return

    this.params.realtime?.emit(`conv:${updated.whatsappNumber}`, 'message-status', {
      waMessageId: status.id,
      status: status.status,
    })

    const sessionRow = await this.params.sessionRepository.getContext(companyId, updated.whatsappNumber)
    await this.params.hooks?.onStatusUpdate?.(status, sessionRow ? toSessionContract(sessionRow) : null)
  }
}

export { extractAnswer, extractContent }
