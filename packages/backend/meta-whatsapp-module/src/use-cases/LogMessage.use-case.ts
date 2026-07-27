import type { RealtimeNotifierInterface, SessionState } from '@adatechnology/meta-whatsapp-contracts'
import type { InsertMessageParams, MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { MessageRow } from '../schema/schema'

export type LogMessageParams = Omit<InsertMessageParams, 'sessionId'> & {
  startState: SessionState
}

/**
 * O contrato mínimo de `@adatechnology/text-moderation`, declarado aqui em vez de importado.
 *
 * Assim o módulo não ganha dependência de pacote para um recurso opcional, e — mais importante —
 * moderação não fica amarrada a WhatsApp: o que atravessa esta fronteira é texto, e qualquer canal
 * que passe a escrever no transcript por este use case herda a marcação sem tocar nada aqui.
 */
export type MessageModerator = {
  inspect: (text: string) => { isOffensive: boolean; matchedTerms: readonly string[] }
}

// T3.3 — ponto único de escrita no transcript: garante a sessão (getOrCreate), insere a
// mensagem (idempotente por waMessageId) e notifica em tempo real. Usado tanto pelo canal
// (T5.2, ao enviar) quanto pelo webhook (T5.1, ao receber).
export class LogMessageUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly realtime?: RealtimeNotifierInterface,
    private readonly moderator?: MessageModerator,
  ) {}

  async execute(params: LogMessageParams): Promise<MessageRow | undefined> {
    const session = await this.sessionRepository.getOrCreate(params.companyId, params.whatsappNumber, params.startState)

    const saved = await this.messageRepository.insertMessage({
      ...params,
      sessionId: session.id,
      ...this.moderationOf(params),
    })
    // Entrega duplicada (mesmo waMessageId) — não emite evento nem re-carimba a janela.
    if (!saved) return undefined

    if (params.direction === 'inbound') {
      await this.sessionRepository.touchInbound(params.companyId, params.whatsappNumber)
    }

    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'message', {
      direction: params.direction,
      sender: params.sender,
    })
    this.realtime?.emit('global', 'data-changed', {})

    return saved
  }

  // Só o que o cliente escreveu: marcar o que o próprio atendente ou o bot enviou não sinaliza
  // abuso, apenas sujaria o transcript com etiqueta na resposta de quem atende.
  private moderationOf(params: LogMessageParams): Pick<InsertMessageParams, 'moderationFlagged' | 'moderationTerms'> {
    if (!this.moderator || params.direction !== 'inbound') return {}

    const text = params.content?.trim()
    if (!text) return {}

    const verdict = this.moderator.inspect(text)

    return {
      moderationFlagged: verdict.isOffensive,
      moderationTerms: verdict.isOffensive ? [...verdict.matchedTerms] : null,
    }
  }
}
