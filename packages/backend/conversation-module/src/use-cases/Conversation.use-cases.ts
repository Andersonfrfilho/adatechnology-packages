/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import type { ConversationChannel } from '@adatechnology/conversation-contracts'

import type { ConversationRow } from '../schema/schema'
import type { ConversationRepositoryPort } from '../repositories/ports'

export type OpenConversationInput = {
  readonly companyId: string
  readonly participant: {
    readonly channel: ConversationChannel
    readonly identifier: string
  }
  /** Ausente: conversa por pessoa, idempotente pelo participante. Presente: conversa por assunto (CA02). */
  readonly subject?: {
    readonly subjectType: string
    readonly subjectId: string
    readonly audience?: string
  }
}

export type OpenConversationDeps = {
  readonly conversations: ConversationRepositoryPort
}

/**
 * CA02: abrir com assunto e abrir sem assunto passam pelo **mesmo** caso de uso — a única
 * diferença é qual idempotência a porta resolve (`findBySubject` x `findOpenByParticipant`).
 */
export class OpenConversationUseCase {
  constructor(private readonly deps: OpenConversationDeps) {}

  async execute(input: OpenConversationInput): Promise<ConversationRow> {
    const { conversations } = this.deps

    const existing = input.subject
      ? await conversations.findBySubject({
          companyId: input.companyId,
          subjectType: input.subject.subjectType,
          subjectId: input.subject.subjectId,
          audience: input.subject.audience ?? null,
        })
      : await conversations.findOpenByParticipant({
          companyId: input.companyId,
          channel: input.participant.channel,
          identifier: input.participant.identifier,
        })

    const conversation =
      existing ??
      (await conversations.create({
        companyId: input.companyId,
        subjectType: input.subject?.subjectType ?? null,
        subjectId: input.subject?.subjectId ?? null,
        audience: input.subject?.audience ?? null,
      }))

    await conversations.addParticipant({
      companyId: input.companyId,
      conversationId: conversation.id,
      channel: input.participant.channel,
      identifier: input.participant.identifier,
    })

    return conversation
  }
}
