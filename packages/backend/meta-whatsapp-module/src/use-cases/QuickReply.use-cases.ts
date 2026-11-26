import {
  QuickReplyNotFoundError,
  type ListWhatsAppQuickRepliesQuery,
  type WhatsAppQuickReply,
  type WhatsAppQuickReplyInput,
} from '@adatechnology/meta-whatsapp-contracts'
import type { QuickReplyRepository } from '../repositories/QuickReplyRepository'
import type { QuickReplyRow } from '../schema/schema'

export function toQuickReplyView(row: QuickReplyRow): WhatsAppQuickReply {
  return {
    id: row.id,
    title: row.title,
    shortcut: row.shortcut,
    body: row.body,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type ListQuickRepliesParams = ListWhatsAppQuickRepliesQuery & { companyId: string }
export type SaveQuickReplyParams = WhatsAppQuickReplyInput & { companyId: string }
export type UpdateQuickReplyParams = SaveQuickReplyParams & { id: string }
export type DeleteQuickReplyParams = { companyId: string; id: string }

export class ListQuickRepliesUseCase {
  constructor(private readonly repository: QuickReplyRepository) {}

  async execute(params: ListQuickRepliesParams): Promise<WhatsAppQuickReply[]> {
    const rows = await this.repository.list({
      companyId: params.companyId,
      ...(params.search ? { search: params.search } : {}),
    })
    return rows.map(toQuickReplyView)
  }
}

export class CreateQuickReplyUseCase {
  constructor(private readonly repository: QuickReplyRepository) {}

  async execute(params: SaveQuickReplyParams): Promise<WhatsAppQuickReply> {
    return toQuickReplyView(await this.repository.create(params))
  }
}

export class UpdateQuickReplyUseCase {
  constructor(private readonly repository: QuickReplyRepository) {}

  async execute(params: UpdateQuickReplyParams): Promise<WhatsAppQuickReply> {
    return toQuickReplyView(await this.repository.update(params))
  }
}

export class DeleteQuickReplyUseCase {
  constructor(private readonly repository: QuickReplyRepository) {}

  async execute(params: DeleteQuickReplyParams): Promise<void> {
    const wasDeleted = await this.repository.delete(params.companyId, params.id)
    if (!wasDeleted) throw new QuickReplyNotFoundError(params.id)
  }
}
