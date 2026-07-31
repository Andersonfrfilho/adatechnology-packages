import { and, eq, lt } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type { MessageDirection, MessageSender, MessageStatus } from '@adatechnology/meta-whatsapp-contracts'
import { messages, type MessageRow, type NewMessageRow } from '../schema/schema'
import type { TranscriptionStatus } from '../transcription.types'

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

export interface SaveTranscriptionParams {
  companyId: string
  messageId: string
  status: TranscriptionStatus
  /** Ausente em `pending`/`failed`/`unsupported`; vazio em `done` é silêncio já processado. */
  text?: string | null
  language?: string | null
  engine?: string | null
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

  async findById(companyId: string, messageId: string): Promise<MessageRow | undefined> {
    const [found] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.companyId, companyId), eq(messages.id, messageId)))
      .limit(1)
    return found
  }

  /**
   * Grava o resultado da transcrição. Devolve `undefined` quando a mensagem não existe (apagada
   * entre o enfileiramento e a execução do job) — não é erro, é corrida normal.
   *
   * `text`/`language`/`engine` só são tocados quando informados: uma retentativa que volta a falhar
   * atualiza o status sem apagar a transcrição parcial de uma tentativa anterior que tenha vindo de
   * outro engine da cadeia.
   */
  async saveTranscription(params: SaveTranscriptionParams): Promise<MessageRow | undefined> {
    const [updated] = await this.db
      .update(messages)
      .set({
        transcriptionStatus: params.status,
        ...(params.text !== undefined ? { transcriptionText: params.text } : {}),
        ...(params.language !== undefined ? { transcriptionLanguage: params.language } : {}),
        ...(params.engine !== undefined ? { transcriptionEngine: params.engine } : {}),
      })
      .where(and(eq(messages.companyId, params.companyId), eq(messages.id, params.messageId)))
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
