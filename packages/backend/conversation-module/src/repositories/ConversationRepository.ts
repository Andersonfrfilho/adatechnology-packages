/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq, isNull } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import {
  conversationParticipants,
  conversations,
  type ConversationParticipantRow,
  type ConversationRow,
  type NewConversationParticipantRow,
  type NewConversationRow,
} from '../schema/schema'
import type {
  ConversationRepositoryPort,
  FindConversationBySubjectParams,
  FindOpenConversationByParticipantParams,
  FindParticipantParams,
} from './ports'

// Toda cláusula carrega `eq(conversations.companyId, ...)` por construção — nenhum método aceita
// id sem escopar por empresa (`security.md` §5).
export class ConversationRepository implements ConversationRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async create(values: NewConversationRow): Promise<ConversationRow> {
    const [row] = await this.db.insert(conversations).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em conversations não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ConversationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.companyId, params.companyId), eq(conversations.id, params.id)))
      .limit(1)
    return row
  }

  async findBySubject(params: FindConversationBySubjectParams): Promise<ConversationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.companyId, params.companyId),
          eq(conversations.subjectType, params.subjectType),
          eq(conversations.subjectId, params.subjectId),
          params.audience === null ? isNull(conversations.audience) : eq(conversations.audience, params.audience),
        ),
      )
      .limit(1)
    return row
  }

  async findOpenByParticipant(params: FindOpenConversationByParticipantParams): Promise<ConversationRow | undefined> {
    const [row] = await this.db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.companyId, conversations.companyId),
          eq(conversationParticipants.conversationId, conversations.id),
        ),
      )
      .where(
        and(
          eq(conversations.companyId, params.companyId),
          isNull(conversations.subjectType),
          eq(conversations.status, 'open'),
          eq(conversationParticipants.channel, params.channel),
          eq(conversationParticipants.identifier, params.identifier),
        ),
      )
      .limit(1)
    return row?.conversation
  }

  async addParticipant(values: NewConversationParticipantRow): Promise<ConversationParticipantRow> {
    const existing = await this.findParticipant({
      companyId: values.companyId,
      conversationId: values.conversationId,
      channel: values.channel,
      identifier: values.identifier,
    })
    if (existing) return existing
    const [row] = await this.db.insert(conversationParticipants).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em participants não retornou linha')
    return row
  }

  async findParticipant(params: FindParticipantParams): Promise<ConversationParticipantRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.companyId, params.companyId),
          eq(conversationParticipants.conversationId, params.conversationId),
          eq(conversationParticipants.channel, params.channel),
          eq(conversationParticipants.identifier, params.identifier),
        ),
      )
      .limit(1)
    return row
  }
}
