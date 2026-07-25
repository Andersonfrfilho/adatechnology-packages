import type { SessionRepository } from '../repositories/SessionRepository'
import type { RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'

export type ReleaseConversationParams = {
  companyId: string
  whatsappNumber: string
}

// T3.3 — devolve a conversa ao bot.
export class ReleaseConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly realtime?: RealtimeNotifierInterface,
  ) {}

  async execute(params: ReleaseConversationParams): Promise<void> {
    await this.sessionRepository.release(params.companyId, params.whatsappNumber)
    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'mode-changed', { mode: 'bot', assignedUserId: null })
    this.realtime?.emit('global', 'data-changed', {})
  }
}
