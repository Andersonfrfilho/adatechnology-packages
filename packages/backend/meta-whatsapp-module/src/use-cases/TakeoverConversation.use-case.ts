import type { SessionRepository } from '../repositories/SessionRepository'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'

export type TakeoverConversationParams = {
  companyId: string
  whatsappNumber: string
  agentUserId: string
}

// T3.3 — atendente assume a conversa (tira do bot). Emite evento para os clientes de admin
// atualizarem a UI (badge "atendido por", desabilitar botão de takeover) em tempo real.
export class TakeoverConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly realtime?: RealtimeNotifierInterface,
  ) {}

  async execute(params: TakeoverConversationParams): Promise<void> {
    await this.sessionRepository.takeover(params.companyId, params.whatsappNumber, params.agentUserId)
    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'mode-changed', {
      mode: 'human',
      assignedUserId: params.agentUserId,
    })
    this.realtime?.emit('global', 'data-changed', {})
  }
}
