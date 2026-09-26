/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq, lt, or, sql } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import { conversationMessages, type ConversationMessageRow, type NewConversationMessageRow } from '../schema/schema'
import { decodeMessageCursor, encodeMessageCursor } from './cursor'
import type {
  FindMessageByProviderIdParams,
  ListConversationMessagesPage,
  ListConversationMessagesParams,
  MessageRepositoryPort,
  UpdateMessageStatusParams,
} from './ports'

export class MessageRepository implements MessageRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async create(values: NewConversationMessageRow): Promise<ConversationMessageRow> {
    const [row] = await this.db.insert(conversationMessages).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em messages não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ConversationMessageRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationMessages)
      .where(and(eq(conversationMessages.companyId, params.companyId), eq(conversationMessages.id, params.id)))
      .limit(1)
    return row
  }

  async findByProviderMessageId(params: FindMessageByProviderIdParams): Promise<ConversationMessageRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationMessages)
      .where(
        and(
          eq(conversationMessages.companyId, params.companyId),
          eq(conversationMessages.channel, params.channel),
          eq(conversationMessages.providerMessageId, params.providerMessageId),
        ),
      )
      .limit(1)
    return row
  }

  async updateStatus(params: UpdateMessageStatusParams): Promise<ConversationMessageRow | undefined> {
    const [row] = await this.db
      .update(conversationMessages)
      .set({ status: params.status, statusTimes: { ...params.statusTimes } })
      .where(and(eq(conversationMessages.companyId, params.companyId), eq(conversationMessages.id, params.id)))
      .returning()
    return row
  }

  async list(params: ListConversationMessagesParams): Promise<ListConversationMessagesPage> {
    const cursor = params.cursor ? decodeMessageCursor(params.cursor) : undefined
    const conditions = [
      eq(conversationMessages.companyId, params.companyId),
      eq(conversationMessages.conversationId, params.conversationId),
    ]
    if (cursor) {
      conditions.push(
        or(
          lt(conversationMessages.createdAt, cursor.createdAt),
          and(eq(conversationMessages.createdAt, cursor.createdAt), lt(conversationMessages.id, cursor.id)),
        )!,
      )
    }

    // Busca uma linha a mais para saber se existe próxima página sem uma segunda query de count.
    const rows = await this.db
      .select()
      .from(conversationMessages)
      .where(and(...conditions))
      .orderBy(sql`${conversationMessages.createdAt} desc`, sql`${conversationMessages.id} desc`)
      .limit(params.perPage + 1)

    const hasNextPage = rows.length > params.perPage
    const page = hasNextPage ? rows.slice(0, params.perPage) : rows
    const lastRow = page[page.length - 1]
    const nextCursor = hasNextPage && lastRow ? encodeMessageCursor(lastRow) : undefined

    return { rows: page, nextCursor }
  }
}
