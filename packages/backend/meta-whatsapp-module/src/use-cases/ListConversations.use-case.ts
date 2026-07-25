import type { ConversationSummary } from '@adatechnology/meta-whatsapp-contracts'
import type { ListConversationsFilters, SessionRepository } from '../repositories/SessionRepository'

export type ListConversationsParams = {
  companyId: string
  filters?: ListConversationsFilters
}

// T3.3 — listagem paginada/filtrada de conversas para a tela de inbox do host.
export class ListConversationsUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(params: ListConversationsParams): Promise<ConversationSummary[]> {
    return this.sessionRepository.listByContextFilters(params.companyId, params.filters ?? {})
  }
}
