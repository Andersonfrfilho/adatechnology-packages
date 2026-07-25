import { and, eq, lt } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres'
import type { AnyRelations, EmptyRelations } from 'drizzle-orm/relations'
import type { MessageDirection, MessageSender, MessageStatus } from '@adatechnology/meta-whatsapp-contracts'
import { messages, type MessageRow, type NewMessageRow } from '../schema/schema'

export interface InsertMessageParams {
  companyId: string
  sessionId: string
  whatsappNumber: string
  direction: MessageDirection
  sender: MessageSender
  agentUserId?: string | null
  type: string
  content?: string | null
  payload?: Record<string, unknown> | null
  waMessageId?: string | null
  status?: MessageStatus | null
}

export interface ListMessagesParams {
  companyId: string
  sessionId: string
  limit?: number
  before?: string
}

const DEFAULT_LIMIT = 50

export class MessageRepository {
  constructor(private readonly db: BunSQLDatabase<AnyRelations | EmptyRelations>) {}

  // Idempotente por waMessageId dentro da empresa — o mesmo webhook pode chegar mais de uma vez
  // (Meta reenvia em cenários de instabilidade); insere só se ainda não existir.
  async insertMessage(params: InsertMessageParams): Promise<MessageRow | undefined> {
    if (params.waMessageId) {
      const [existing] = await this.db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.companyId, params.companyId), eq(messages.waMessageId, params.waMessageId)))
        .limit(1)
      if (existing) return undefined
    }

    const values: NewMessageRow = {
      companyId: params.companyId,
      sessionId: params.sessionId,
      whatsappNumber: params.whatsappNumber,
      direction: params.direction,
      sender: params.sender,
      agentUserId: params.agentUserId ?? null,
      type: params.type,
      content: params.content ?? null,
      payload: params.payload ?? null,
      waMessageId: params.waMessageId ?? null,
      status: params.status ?? null,
    }

    const [created] = await this.db.insert(messages).values(values).returning()
    return created
  }

  async updateMessageStatus(
    companyId: string,
    waMessageId: string,
    status: MessageStatus,
  ): Promise<MessageRow | undefined> {
    const [updated] = await this.db
      .update(messages)
      .set({ status, ...(status === 'read' ? { readAt: new Date() } : {}) })
      .where(and(eq(messages.companyId, companyId), eq(messages.waMessageId, waMessageId)))
      .returning()
    return updated
  }

  async listByConversation(params: ListMessagesParams): Promise<MessageRow[]> {
    const conditions = [eq(messages.companyId, params.companyId), eq(messages.sessionId, params.sessionId)]
    if (params.before) conditions.push(lt(messages.createdAt, new Date(params.before)))

    return this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(messages.createdAt)
      .limit(params.limit ?? DEFAULT_LIMIT)
  }
}
