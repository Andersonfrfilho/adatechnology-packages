/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Separa a entrega do webhook em duas metades: o que precisa acontecer antes de responder à Meta
 * (persistir a mensagem, que é escrita local e rápida) e o que pode esperar alguns milissegundos
 * (os hooks do host, que costumam falar com rede — motor de fluxo, IA, integrações).
 *
 * A segunda metade rodava dentro da requisição do webhook. Um deploy no meio de uma conversa
 * matava a chamada em voo, e o cliente ficava sem resposta sem que nada registrasse a perda. Com
 * uma fila no host, derrubar o processo vira atraso: o job espera e é retomado.
 *
 * Guia de implementação: `docs/webhook-durability.md`.
 */

import type {
  ConversationSession,
  MetaWhatsAppHooks,
  RealtimeNotifierInterface,
  WhatsAppMessage,
  WhatsAppStatus,
} from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SessionRow } from '../schema/schema'

export type InboundMediaDescriptor = {
  sourceMediaId: string
  mimeType: string
  filename?: string
}

export type InboundMessageEffectsJob = {
  kind: 'message'
  companyId: string
  message: WhatsAppMessage
  savedMessageId: string
  media?: InboundMediaDescriptor
  receivedAt: number
}

export type InboundStatusEffectsJob = {
  kind: 'status'
  companyId: string
  status: WhatsAppStatus
  whatsappNumber: string
  receivedAt: number
}

export type InboundDispatchJob = InboundMessageEffectsJob | InboundStatusEffectsJob

/**
 * Porta de fila. O módulo não escolhe a tecnologia — BullMQ, SQS, o que o host já tiver — mas
 * exige dela duas garantias, e sem as duas o padrão não entrega o que promete:
 *
 * 1. **Durabilidade**: o job sobrevive à morte do processo que o enfileirou. Uma fila em memória
 *    reintroduz exatamente a perda que este desenho existe para evitar.
 * 2. **Retentativa com backoff**: o destino dos hooks (n8n, IA, API de terceiro) também cai em
 *    deploy. Sem retry, o job falha uma vez e a conversa morre do mesmo jeito.
 *
 * `jobId` é estável e derivado da mensagem: reentrega da Meta e re-enfileiramento produzem o mesmo
 * id, e a fila descarta o segundo em vez de rodar o efeito duas vezes.
 */
export interface InboundDispatchQueueInterface {
  enqueue(job: InboundDispatchJob, options: { jobId: string }): Promise<void>
}

export function buildInboundJobId(job: InboundDispatchJob): string {
  return job.kind === 'message'
    ? `wa-inbound-message:${job.message.id}`
    : `wa-inbound-status:${job.status.id}:${job.status.status}`
}

export function toSessionContract(row: SessionRow): ConversationSession {
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

/**
 * A resposta que o motor de fluxo deve consumir: para interativo é o ID da opção (estável), não
 * o título (que muda quando alguém edita o texto do botão no editor).
 */
export function extractAnswer(message: WhatsAppMessage): string | undefined {
  const interactive = message.interactive
  if (interactive?.button_reply) return interactive.button_reply.id
  if (interactive?.list_reply) return interactive.list_reply.id
  return message.text?.body
}

/**
 * Os efeitos de host de uma entrega já persistida. Vive fora do `ReceiveWebhookUseCase` porque
 * roda nos dois lados: inline, quando o host não configurou fila, e dentro do worker, quando
 * configurou. Um só corpo de regra para os dois caminhos — duas cópias divergiriam.
 */
export class InboundEffectsDispatcher {
  constructor(
    private readonly params: {
      sessionRepository: SessionRepository
      hooks?: MetaWhatsAppHooks
      realtime?: RealtimeNotifierInterface
    },
  ) {}

  async run(job: InboundDispatchJob): Promise<void> {
    if (job.kind === 'message') return this.runMessageEffects(job)
    return this.runStatusEffects(job)
  }

  async runMessageEffects(job: InboundMessageEffectsJob): Promise<void> {
    const { companyId, message, savedMessageId, media } = job

    // Antes de qualquer retorno antecipado: os `return` abaixo (atendimento humano, sessão ausente)
    // são sobre o FLUXO DO BOT, e mídia precisa ser copiada da Meta de qualquer forma. Justamente em
    // atendimento humano é que o cliente manda documento para o atendente — deixar a ingestão
    // depois desse `return` perderia esses arquivos, e a URL da Meta expira sem segunda chance.
    if (media) {
      await this.params.hooks?.onMediaReceived?.({
        companyId,
        messageId: savedMessageId,
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

  async runStatusEffects(job: InboundStatusEffectsJob): Promise<void> {
    const sessionRow = await this.params.sessionRepository.getContext(job.companyId, job.whatsappNumber)
    await this.params.hooks?.onStatusUpdate?.(job.status, sessionRow ? toSessionContract(sessionRow) : null)
  }
}

/**
 * Ponto de entrada do worker do host: recebe o job que a fila devolveu e roda os efeitos.
 *
 * Deixe a exceção propagar. É ela que faz a fila contar a tentativa e reagendar com backoff;
 * capturar aqui para logar transforma falha recuperável em mensagem perdida em silêncio.
 */
export class ProcessInboundDispatchUseCase {
  constructor(private readonly dispatcher: InboundEffectsDispatcher) {}

  async execute(job: InboundDispatchJob): Promise<void> {
    await this.dispatcher.run(job)
  }
}
