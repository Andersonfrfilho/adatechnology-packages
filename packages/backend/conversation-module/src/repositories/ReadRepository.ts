/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import { conversationReads, type ConversationReadRow } from '../schema/schema'
import type { ReadRepositoryPort, UpsertConversationReadParams } from './ports'

export class ReadRepository implements ReadRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async upsert(params: UpsertConversationReadParams): Promise<ConversationReadRow> {
    const [row] = await this.db
      .insert(conversationReads)
      .values({
        companyId: params.companyId,
        conversationId: params.conversationId,
        userId: params.userId,
        lastReadMessageId: params.lastReadMessageId,
        readAt: params.readAt,
      })
      .onConflictDoUpdate({
        target: [conversationReads.companyId, conversationReads.conversationId, conversationReads.userId],
        set: { lastReadMessageId: params.lastReadMessageId, readAt: params.readAt },
      })
      .returning()
    if (!row) throw new Error('conversation-module: upsert em reads não retornou linha')
    return row
  }

  async find(params: {
    companyId: string
    conversationId: string
    userId: string
  }): Promise<ConversationReadRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationReads)
      .where(
        and(
          eq(conversationReads.companyId, params.companyId),
          eq(conversationReads.conversationId, params.conversationId),
          eq(conversationReads.userId, params.userId),
        ),
      )
      .limit(1)
    return row
  }
}
