import type { MessageRepository, ListMessagesParams as RepoListMessagesParams } from '../repositories/MessageRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import { SessionNotFoundError } from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRow } from '../schema/schema'

export type ListMessagesParams = {
  companyId: string
  whatsappNumber: string
  limit?: number
  before?: string
}

// T3.3 — histórico paginado de uma conversa (resolve sessionId a partir do número antes de
// delegar ao repositório de mensagens).
export class ListMessagesUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly messageRepository: MessageRepository,
  ) {}

  async execute(params: ListMessagesParams): Promise<MessageRow[]> {
    const session = await this.sessionRepository.getContext(params.companyId, params.whatsappNumber)
    if (!session) throw new SessionNotFoundError(params.whatsappNumber)

    const repoParams: RepoListMessagesParams = {
      companyId: params.companyId,
      sessionId: session.id,
      limit: params.limit,
      before: params.before,
    }
    return this.messageRepository.listByConversation(repoParams)
  }
}
