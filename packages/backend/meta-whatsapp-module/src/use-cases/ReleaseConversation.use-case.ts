import type { SessionRepository } from '../repositories/SessionRepository'
import type { MetaWhatsAppHooks, RealtimeNotifierInterface } from '@adatechnology/meta-whatsapp-contracts'

export type ReleaseConversationParams = {
  companyId: string
  whatsappNumber: string
  /** Quem devolveu a conversa ao bot. Omitido, `null` — o próprio sistema (ex.: job de inatividade). */
  actorId?: string | null
}

// T3.3 — devolve a conversa ao bot.
export class ReleaseConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly realtime?: RealtimeNotifierInterface,
    private readonly hooks?: Pick<MetaWhatsAppHooks, 'onConversationModeChanged'>,
  ) {}

  async execute(params: ReleaseConversationParams): Promise<void> {
    await this.sessionRepository.release(params.companyId, params.whatsappNumber)
    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'mode-changed', {
      companyId: params.companyId,
      mode: 'bot',
      assignedUserId: null,
    })
    this.realtime?.emit('global', 'data-changed', {})
    await this.hooks?.onConversationModeChanged?.({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      kind: 'release',
      mode: 'bot',
      assignedUserId: null,
      actorId: params.actorId ?? null,
      occurredAt: new Date(),
    })
  }
}
