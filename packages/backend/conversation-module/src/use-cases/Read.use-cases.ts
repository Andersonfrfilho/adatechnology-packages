/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { ClockPort } from '@adatechnology/conversation-contracts'

import { MessageNotFoundError } from '../errors'
import type { ConversationMessageRow, ConversationReadRow } from '../schema/schema'
import type { MessageRepositoryPort, ReadRepositoryPort } from '../repositories/ports'

export type MarkConversationReadInput = {
  readonly companyId: string
  readonly conversationId: string
  readonly userId: string
  readonly lastReadMessageId: string
}

export type MarkConversationReadDeps = {
  readonly reads: ReadRepositoryPort
  readonly messages: MessageRepositoryPort
  readonly clock: ClockPort
}

/** `createdAt` desempatado por `id`, mesma ordem total do cursor de listagem. */
function isNewer(candidate: ConversationMessageRow, current: ConversationMessageRow): boolean {
  const candidateTime = candidate.createdAt.getTime()
  const currentTime = current.createdAt.getTime()
  if (candidateTime !== currentTime) return candidateTime > currentTime
  return candidate.id > current.id
}

/**
 * RF6: marcar lido só avança — nunca retrocede a última mensagem lida registrada. Não avisa a
 * outra parte: as dependências não incluem nenhuma porta de notificação.
 */
export class MarkConversationReadUseCase {
  constructor(private readonly deps: MarkConversationReadDeps) {}

  async execute(input: MarkConversationReadInput): Promise<ConversationReadRow> {
    const candidate = await this.deps.messages.findById({ companyId: input.companyId, id: input.lastReadMessageId })
    if (!candidate) throw new MessageNotFoundError(input.lastReadMessageId)

    const current = await this.deps.reads.find({
      companyId: input.companyId,
      conversationId: input.conversationId,
      userId: input.userId,
    })

    if (current) {
      const currentMessage = await this.deps.messages.findById({
        companyId: input.companyId,
        id: current.lastReadMessageId,
      })
      if (currentMessage && !isNewer(candidate, currentMessage)) return current
    }

    return this.deps.reads.upsert({
      companyId: input.companyId,
      conversationId: input.conversationId,
      userId: input.userId,
      lastReadMessageId: input.lastReadMessageId,
      readAt: this.deps.clock.now(),
    })
  }
}
