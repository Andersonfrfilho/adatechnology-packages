import {
  SessionNotFoundError,
  type MetaWhatsAppHooks,
  type RealtimeNotifierInterface,
  type SessionMode,
} from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '../repositories/SessionRepository'
import { toSessionContract } from '../channel/inboundDispatch'

export type RequestHumanConversationParams = {
  companyId: string
  whatsappNumber: string
  /** Quem pediu. Omitido, `null` — o cliente pelo menu ou o bot decidindo encaminhar. */
  actorId?: string | null
}

/**
 * Coloca a conversa na fila "aguardando atendimento" (`humanRequestedAt`) sem tirá-la do bot: quem
 * assume é o `takeover`. Dispara `onHumanRequested` (o host decide como avisar a equipe) e
 * `onConversationModeChanged` com `kind: 'human-requested'` (trilha de auditoria).
 */
export class RequestHumanConversationUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly realtime?: RealtimeNotifierInterface,
    private readonly hooks?: Pick<MetaWhatsAppHooks, 'onHumanRequested' | 'onConversationModeChanged'>,
  ) {}

  async execute(params: RequestHumanConversationParams): Promise<void> {
    await this.sessionRepository.requestHuman(params.companyId, params.whatsappNumber)
    const session = await this.sessionRepository.getContext(params.companyId, params.whatsappNumber)
    if (!session) throw new SessionNotFoundError(params.whatsappNumber)

    this.realtime?.emit(`conv:${params.whatsappNumber}`, 'human-requested', {
      humanRequestedAt: session.humanRequestedAt?.toISOString() ?? null,
    })
    this.realtime?.emit('global', 'data-changed', {})
    await this.hooks?.onHumanRequested?.(toSessionContract(session))
    await this.hooks?.onConversationModeChanged?.({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      kind: 'human-requested',
      mode: session.mode as SessionMode,
      assignedUserId: session.assignedUserId,
      actorId: params.actorId ?? null,
      occurredAt: new Date(),
    })
  }
}
