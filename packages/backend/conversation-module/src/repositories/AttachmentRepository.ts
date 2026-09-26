/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 */
import { and, eq } from 'drizzle-orm'

import type { ConversationDatabase } from '../database.types'
import {
  conversationAttachments,
  conversationUploads,
  type ConversationAttachmentRow,
  type ConversationUploadRow,
  type NewConversationAttachmentRow,
  type NewConversationUploadRow,
} from '../schema/schema'
import type { AttachmentRepositoryPort } from './ports'

export class AttachmentRepository implements AttachmentRepositoryPort {
  constructor(private readonly db: ConversationDatabase) {}

  async create(values: NewConversationAttachmentRow): Promise<ConversationAttachmentRow> {
    const [row] = await this.db.insert(conversationAttachments).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em attachments não retornou linha')
    return row
  }

  async findById(params: { companyId: string; id: string }): Promise<ConversationAttachmentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationAttachments)
      .where(and(eq(conversationAttachments.companyId, params.companyId), eq(conversationAttachments.id, params.id)))
      .limit(1)
    return row
  }

  async listByMessage(params: { companyId: string; messageId: string }): Promise<ConversationAttachmentRow[]> {
    return this.db
      .select()
      .from(conversationAttachments)
      .where(
        and(
          eq(conversationAttachments.companyId, params.companyId),
          eq(conversationAttachments.messageId, params.messageId),
        ),
      )
  }

  async createUpload(values: NewConversationUploadRow): Promise<ConversationUploadRow> {
    const [row] = await this.db.insert(conversationUploads).values(values).returning()
    if (!row) throw new Error('conversation-module: insert em uploads não retornou linha')
    return row
  }

  async findUploadByObjectKey(params: {
    companyId: string
    objectKey: string
  }): Promise<ConversationUploadRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationUploads)
      .where(
        and(eq(conversationUploads.companyId, params.companyId), eq(conversationUploads.objectKey, params.objectKey)),
      )
      .limit(1)
    return row
  }

  async findUploadById(params: { companyId: string; id: string }): Promise<ConversationUploadRow | undefined> {
    const [row] = await this.db
      .select()
      .from(conversationUploads)
      .where(and(eq(conversationUploads.companyId, params.companyId), eq(conversationUploads.id, params.id)))
      .limit(1)
    return row
  }

  async markUploadAttached(params: {
    companyId: string
    id: string
    attachedAt: Date
  }): Promise<ConversationUploadRow | undefined> {
    const [row] = await this.db
      .update(conversationUploads)
      .set({ status: 'attached', attachedAt: params.attachedAt })
      .where(and(eq(conversationUploads.companyId, params.companyId), eq(conversationUploads.id, params.id)))
      .returning()
    return row
  }
}
