/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq, asc } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import {
  conversationQuickReplies,
  type ConversationQuickReplyRow,
  type NewConversationQuickReplyRow,
} from '../schema/schema'
import type { QuickReplyRepositoryPort } from './ports'

export class QuickReplyRepository implements QuickReplyRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async create(values: NewConversationQuickReplyRow): Promise<ConversationQuickReplyRow> {
    const [row] = await this.db.insert(conversationQuickReplies).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em quick_replies não retornou linha')
    return row
  }

  async listByAudience(params: { companyId: string; audience: string }): Promise<ConversationQuickReplyRow[]> {
    return this.db
      .select()
      .from(conversationQuickReplies)
      .where(
        and(
          eq(conversationQuickReplies.companyId, params.companyId),
          eq(conversationQuickReplies.audience, params.audience),
        ),
      )
      .orderBy(asc(conversationQuickReplies.position))
  }

  async listByCompany(params: { companyId: string }): Promise<ConversationQuickReplyRow[]> {
    return this.db
      .select()
      .from(conversationQuickReplies)
      .where(eq(conversationQuickReplies.companyId, params.companyId))
      .orderBy(asc(conversationQuickReplies.position))
  }

  async findById(params: { companyId: string; id: string }): Promise<ConversationQuickReplyRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationQuickReplies)
      .where(and(eq(conversationQuickReplies.companyId, params.companyId), eq(conversationQuickReplies.id, params.id)))
      .limit(1)
    return row
  }

  async update(params: {
    companyId: string
    id: string
    bodyText?: string
    position?: number
    active?: boolean
  }): Promise<ConversationQuickReplyRow | undefined> {
    const patch: Partial<NewConversationQuickReplyRow> = { updatedAt: new Date() }
    if (params.bodyText !== undefined) patch.bodyText = params.bodyText
    if (params.position !== undefined) patch.position = params.position
    if (params.active !== undefined) patch.active = params.active

    const [row] = await this.db
      .update(conversationQuickReplies)
      .set(patch)
      .where(and(eq(conversationQuickReplies.companyId, params.companyId), eq(conversationQuickReplies.id, params.id)))
      .returning()
    return row
  }
}
