import type { SessionRepository } from '../repositories/SessionRepository'
import type { MetaWhatsAppHooks, RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'

export type TakeoverConversationParams = {
  companyId: string
  whatsappNumber: string
  agentUserId: string
  /**
   * Quem executou a ação, quando não é o próprio atendente (ex.: supervisor atribuindo a conversa a
   * outra pessoa). Omitido, o ator é `agentUserId`.
   */
  actorId?: string
}

// T3.3 — atendente assume a conversa (tira do bot). Emite evento para os clientes de admin
// atualizarem a UI (badge "atendido por", desabilitar botão de takeover) em tempo real.
export class TakeoverConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly realtime?: RealtimeNotifierInterface,
    private readonly hooks?: Pick<MetaWhatsAppHooks, 'onConversationModeChanged'>,
  ) {}

  async execute(params: TakeoverConversationParams): Promise<void> {
    await this.sessionRepository.takeover(params.companyId, params.whatsappNumber, params.agentUserId)
    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'mode-changed', {
      companyId: params.companyId,
      mode: 'human',
      assignedUserId: params.agentUserId,
    })
    this.realtime?.emit('global', 'data-changed', {})
    await this.hooks?.onConversationModeChanged?.({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      kind: 'takeover',
      mode: 'human',
      assignedUserId: params.agentUserId,
      actorId: params.actorId ?? params.agentUserId,
      occurredAt: new Date(),
    })
  }
}
