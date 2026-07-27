import { and, eq, lt } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
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
  /** `undefined` deixa a coluna nula: não avaliado, distinto de avaliado e limpo. */
  moderationFlagged?: boolean | null
  moderationTerms?: string[] | null
}

export interface ListMessagesParams {
  companyId: string
  sessionId: string
  limit?: number
  before?: string
}

const DEFAULT_LIMIT = 50

export class MessageRepository {
  constructor(private readonly db: MetaWhatsAppDatabase) {}

  // Idempotente por (companyId, waMessageId) — o mesmo webhook chega mais de uma vez (a Meta
  // reenvia em instabilidade) e várias instâncias do host processam em paralelo. A garantia é o
  // índice único parcial no banco + onConflictDoNothing, NÃO um SELECT prévio: duas entregas
  // concorrentes passariam as duas pela checagem e inseririam duplicado.
  // Devolve undefined quando a mensagem já existia (nada foi inserido).
  async insertMessage(params: InsertMessageParams): Promise<MessageRow | undefined> {
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
      moderationFlagged: params.moderationFlagged ?? null,
      moderationTerms: params.moderationTerms ?? null,
    }

    const [created] = await this.db.insert(messages).values(values).onConflictDoNothing().returning()
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
