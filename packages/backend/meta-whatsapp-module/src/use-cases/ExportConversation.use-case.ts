import type { SessionRepository } from '../repositories/SessionRepository'
import { SessionNotFoundError } from '@adatechnology/meta-whatsapp-contracts'
import type { MessageRow, SessionRow } from '../schema/schema'

export type ExportConversationParams = {
  companyId: string
  whatsappNumber: string
}

export type ExportConversationResult = {
  session: SessionRow
  messages: MessageRow[]
}

// T3.3 — transcript completo para export (ex.: anexar num chamado de suporte, auditoria).
export class ExportConversationUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(params: ExportConversationParams): Promise<ExportConversationResult> {
    const result = await this.sessionRepository.exportConversation(params.companyId, params.whatsappNumber)
    if (!result) throw new SessionNotFoundError(params.whatsappNumber)
    return result
  }
}
