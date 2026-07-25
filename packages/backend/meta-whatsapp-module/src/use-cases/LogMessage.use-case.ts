import type { RealtimeNotifierInterface, SessionState } from '@adatechnology/meta-whatsapp-contracts'
import type { InsertMessageParams, MessageRepository } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { MessageRow } from '../schema/schema'

export type LogMessageParams = Omit<InsertMessageParams, 'sessionId'> & {
  startState: SessionState
}

// T3.3 — ponto único de escrita no transcript: garante a sessão (getOrCreate), insere a
// mensagem (idempotente por waMessageId) e notifica em tempo real. Usado tanto pelo canal
// (T5.2, ao enviar) quanto pelo webhook (T5.1, ao receber).
export class LogMessageUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
    private readonly realtime?: RealtimeNotifierInterface,
  ) {}

  async execute(params: LogMessageParams): Promise<MessageRow | undefined> {
    const session = await this.sessionRepository.getOrCreate(params.companyId, params.whatsappNumber, params.startState)

    const saved = await this.messageRepository.insertMessage({ ...params, sessionId: session.id })
    if (!saved) return undefined

    if (params.direction === 'inbound') {
      await this.sessionRepository.setState(params.companyId, params.whatsappNumber, session.currentState)
    }

    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'message', {
      direction: params.direction,
      sender: params.sender,
    })
    this.realtime?.emit('global', 'data-changed', {})

    return saved
  }
}
