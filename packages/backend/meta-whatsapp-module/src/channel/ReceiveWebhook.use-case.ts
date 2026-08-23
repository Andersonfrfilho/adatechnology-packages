import {
  whatsAppWebhookPayloadSchema,
  type MetaWhatsAppHooks,
  type SessionState,
  type WhatsAppMessage,
  type WhatsAppStatus,
  type MessageStatus,
} from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { LogMessageUseCase } from '../use-cases/LogMessage.use-case'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'
import {
  verifyWebhookSignature,
  claimWebhookDelivery,
  confirmWebhookDelivery,
  type NonceStoreInterface,
} from './webhookSecurity'
import { extractMediaDescriptor } from './IngestInboundMedia.use-case'
import {
  InboundEffectsDispatcher,
  buildInboundJobId,
  extractAnswer,
  type InboundDispatchJob,
  type InboundDispatchQueueInterface,
} from './inboundDispatch'

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
  // Eventos de outro número da mesma WABA. Contados em vez de silenciados: um filtro que descarta
  // sem deixar rastro é indistinguível de um webhook que parou de chegar.
  ignoredForeignNumber: number
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
      phoneNumberId: string
      nonceStore: NonceStoreInterface
      sessionRepository: SessionRepository
      messageRepository: MessageRepository
      logMessage: LogMessageUseCase
      startState: SessionState
      hooks?: MetaWhatsAppHooks
      realtime?: RealtimeNotifierInterface
      /**
       * Sem fila o módulo se comporta como sempre: os hooks rodam dentro da requisição do webhook.
       * Configurá-la é o que faz a conversa sobreviver a um deploy no meio do atendimento.
       */
      inboundQueue?: InboundDispatchQueueInterface
    },
  ) {
    this.dispatcher = new InboundEffectsDispatcher({
      sessionRepository: params.sessionRepository,
      ...(params.hooks ? { hooks: params.hooks } : {}),
      ...(params.realtime ? { realtime: params.realtime } : {}),
    })
  }

  private readonly dispatcher: InboundEffectsDispatcher

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
    if (!claimed) return { duplicate: true, messagesProcessed: 0, statusesProcessed: 0, ignoredForeignNumber: 0 }

    const rawText = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8')
    const payload = whatsAppWebhookPayloadSchema.parse(JSON.parse(rawText))

    let messagesProcessed = 0
    let statusesProcessed = 0
    let ignoredForeignNumber = 0

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        // Uma WABA comporta vários números, e a Meta entrega os eventos de TODOS eles para cada app
        // inscrito na conta — a inscrição é por WABA, não por número. Sem este filtro, uma instância
        // responde o cliente de um número que não é dela e grava esse contato na própria base.
        // Metadata ausente segue processando: só a Meta preenche esse campo, e não há como decidir
        // pertencimento sem ele.
        const targetNumber = change.value.metadata?.phone_number_id
        if (targetNumber && targetNumber !== this.params.phoneNumberId) {
          ignoredForeignNumber++
          continue
        }

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

    // Só aqui a entrega vira "processada". Se qualquer coisa acima lançar, o claim curto expira e
    // a reentrega da Meta ainda encontra a porta aberta — que é o ponto de todo este desenho.
    await confirmWebhookDelivery({
      nonceStore: this.params.nonceStore,
      signatureHeader: input.signatureHeader!,
    })

    return { duplicate: false, messagesProcessed, statusesProcessed, ignoredForeignNumber }
  }

  private async handleMessage(companyId: string, message: WhatsAppMessage): Promise<void> {
    // Persistir fica na requisição de propósito: é escrita local, custa pouco, e é o que garante
    // que a mensagem do cliente existe no banco mesmo que tudo depois dela falhe.
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

    const media = extractMediaDescriptor(saved)
    await this.dispatch({
      kind: 'message',
      companyId,
      message,
      savedMessageId: saved.id,
      ...(media ? { media } : {}),
      receivedAt: Date.now(),
    })
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

    await this.dispatch({
      kind: 'status',
      companyId,
      status,
      whatsappNumber: updated.whatsappNumber,
      receivedAt: Date.now(),
    })
  }

  // Com fila configurada, os efeitos saem da requisição do webhook; sem ela, rodam aqui mesmo e o
  // comportamento é o de sempre. É o mesmo `InboundEffectsDispatcher` nos dois caminhos.
  private async dispatch(job: InboundDispatchJob): Promise<void> {
    if (this.params.inboundQueue) {
      await this.params.inboundQueue.enqueue(job, { jobId: buildInboundJobId(job) })
      return
    }
    await this.dispatcher.run(job)
  }
}

export { extractAnswer, extractContent }
