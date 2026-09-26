/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * T211 (RF9): respostas rápidas por público — CRUD simples, sem regra própria neste pacote.
 * Leitura por público, ordenação por position (só ativas para compositor; todas para gestão),
 * criar, editar texto/posição, desativar/reativar com isolamento de tenant.
 */
import { CONVERSATION_QUICK_REPLY_MAX_LENGTH } from '../schema/schema'
import type { ConversationQuickReplyRow, NewConversationQuickReplyRow } from '../schema/schema'
import type { QuickReplyRepositoryPort } from '../repositories/ports'
import { QuickReplyInvalidError, QuickReplyNotFoundError } from '../errors'

export { QuickReplyInvalidError, QuickReplyNotFoundError }

type Clock = { now(): Date }

function normalizeText(bodyText: string): string {
  const text = bodyText.trim()
  if (text === '' || text.length > CONVERSATION_QUICK_REPLY_MAX_LENGTH) {
    throw new QuickReplyInvalidError()
  }
  return text
}

export class CreateQuickReplyUseCase {
  constructor(
    private readonly dependencies: {
      readonly quickReplies: QuickReplyRepositoryPort
      readonly clock: Clock
    },
  ) {}

  async execute(input: {
    readonly companyId: string
    readonly audience: string
    readonly bodyText: string
  }): Promise<ConversationQuickReplyRow> {
    const bodyText = normalizeText(input.bodyText)
    const existing = await this.dependencies.quickReplies.listByAudience({
      companyId: input.companyId,
      audience: input.audience,
    })
    const position = existing.length

    return this.dependencies.quickReplies.create({
      companyId: input.companyId,
      audience: input.audience,
      bodyText,
      position,
      active: true,
    } as NewConversationQuickReplyRow)
  }
}

export class ListAllQuickRepliesUseCase {
  constructor(
    private readonly dependencies: {
      readonly quickReplies: QuickReplyRepositoryPort
    },
  ) {}

  async execute(input: { readonly companyId: string }): Promise<readonly ConversationQuickReplyRow[]> {
    return this.dependencies.quickReplies.listByCompany({
      companyId: input.companyId,
    })
  }
}

export class ListQuickRepliesForComposerUseCase {
  constructor(
    private readonly dependencies: {
      readonly quickReplies: QuickReplyRepositoryPort
    },
  ) {}

  async execute(input: {
    readonly companyId: string
    readonly audience: string
  }): Promise<readonly ConversationQuickReplyRow[]> {
    const all = await this.dependencies.quickReplies.listByAudience({
      companyId: input.companyId,
      audience: input.audience,
    })
    return all.filter((r) => r.active).sort((a, b) => a.position - b.position)
  }
}

export class UpdateQuickReplyUseCase {
  constructor(
    private readonly dependencies: {
      readonly quickReplies: QuickReplyRepositoryPort
      readonly clock: Clock
    },
  ) {}

  async execute(input: {
    readonly companyId: string
    readonly id: string
    readonly bodyText?: string
    readonly position?: number
    readonly active?: boolean
  }): Promise<ConversationQuickReplyRow> {
    const bodyText = input.bodyText === undefined ? undefined : normalizeText(input.bodyText)

    const updated = await this.dependencies.quickReplies.update({
      companyId: input.companyId,
      id: input.id,
      bodyText,
      position: input.position,
      active: input.active,
    })

    if (!updated) throw new QuickReplyNotFoundError(input.id)
    return updated
  }
}
