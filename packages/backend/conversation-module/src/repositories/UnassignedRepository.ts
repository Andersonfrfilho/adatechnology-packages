/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq, isNull } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import {
  conversationUnassigned,
  type ConversationUnassignedRow,
  type NewConversationUnassignedRow,
} from '../schema/schema'
import type {
  AssignUnassignedParams,
  FindUnassignedByProviderIdParams,
  ListOpenUnassignedParams,
  UnassignedRepositoryPort,
} from './ports'

export class UnassignedRepository implements UnassignedRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async create(values: NewConversationUnassignedRow): Promise<ConversationUnassignedRow> {
    const [row] = await this.db.insert(conversationUnassigned).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em unassigned não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ConversationUnassignedRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationUnassigned)
      .where(and(eq(conversationUnassigned.companyId, params.companyId), eq(conversationUnassigned.id, params.id)))
      .limit(1)
    return row
  }

  async findByProviderMessageId(
    params: FindUnassignedByProviderIdParams,
  ): Promise<ConversationUnassignedRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationUnassigned)
      .where(
        and(
          eq(conversationUnassigned.companyId, params.companyId),
          eq(conversationUnassigned.channel, params.channel),
          eq(conversationUnassigned.providerMessageId, params.providerMessageId),
        ),
      )
      .limit(1)
    return row
  }

  async listOpenBySender(params: ListOpenUnassignedParams): Promise<ConversationUnassignedRow[]> {
    return this.db
      .select()
      .from(conversationUnassigned)
      .where(
        and(
          eq(conversationUnassigned.companyId, params.companyId),
          eq(conversationUnassigned.channel, params.channel),
          eq(conversationUnassigned.senderAddress, params.senderAddress),
          isNull(conversationUnassigned.assignedMessageId),
        ),
      )
  }

  async assign(params: AssignUnassignedParams): Promise<ConversationUnassignedRow | undefined> {
    const [row] = await this.db
      .update(conversationUnassigned)
      .set({
        assignedMessageId: params.assignedMessageId,
        assignedByUserId: params.assignedByUserId,
        assignedAt: params.assignedAt,
      })
      .where(and(eq(conversationUnassigned.companyId, params.companyId), eq(conversationUnassigned.id, params.id)))
      .returning()
    return row
  }
}
