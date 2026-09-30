import { and, eq, lt, sql } from 'drizzle-orm'
import type { MetaWhatsAppDatabase } from '../database.types'
import type {
  MessageDirection,
  MessageSender,
  MessageStatus,
  WhatsAppStatusError,
} from '@adatechnology/meta-whatsapp-contracts'
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

export interface UpdateMessageStatusParams {
  companyId: string
  waMessageId: string
  status: MessageStatus
  /**
   * Por que a Meta recusou, quando `status` é `failed`. Fica na linha da mensagem, e não só no
   * log, porque a pergunta que aparece depois é sempre sobre um envio específico: "este pedido o
   * cliente chegou a receber?". Log vence por retenção e some; a linha do transcript não.
   */
  deliveryError?: WhatsAppStatusError | undefined
}

export interface ListMessagesParams {
  companyId: string
  sessionId: string
  limit?: number
  before?: string
}

export interface SaveTranscriptionByWaMessageIdParams extends Omit<SaveTranscriptionParams, 'messageId'> {
  /**
   * Id da mensagem na Meta. É o único que quem processa o webhook conhece — o id do módulo só
   * existe depois da gravação, e obrigar o host a descobri-lo faria cada um escrever a própria
   * consulta por `wa_message_id`.
   */
  waMessageId: string
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

  /**
   * O motivo da recusa entra em `payload` por merge, não por sobrescrita: a coluna já pode guardar
   * o que o envio gravou, e trocar aquilo pelo erro perderia o conteúdo para registrar a falha —
   * exatamente a linha em que se vai querer os dois juntos.
   *
   * O parâmetro vai como objeto, nunca como `JSON.stringify`: o driver `bun-sql` liga string a
   * jsonb como *escalar string*, e aí `||` concatena em array (`[{...}, "{...}"]`) em vez de
   * mesclar, sem erro nenhum para denunciar.
   *
   * `normalizedPayload` existe porque a mesma armadilha já gravou linha torta: `mapToDriverValue`
   * do jsonb do drizzle faz `JSON.stringify`, então toda escrita anterior sob `bun-sql` virou
   * escalar string no banco. A leitura desfaz (`JSON.parse`) e esconde isso do app, mas o `||`
   * não desfaz. Aqui a linha é normalizada de volta a objeto na própria escrita, em vez de o
   * merge produzir lixo sobre um dado que já estava errado.
   *
   * Coberto por `MessageRepository.deliveryError.integration.test.ts` contra Postgres de verdade:
   * é diferença de driver, e mock nenhum a reproduz.
   */
  async updateMessageStatus(params: UpdateMessageStatusParams): Promise<MessageRow | undefined> {
    const { companyId, waMessageId, status, deliveryError } = params
    const column = messages.payload
    const normalizedPayload = sql`case
      when jsonb_typeof(${column}) = 'object' then ${column}
      when jsonb_typeof(${column}) = 'string' then (${column} #>> '{}')::jsonb
      else '{}'::jsonb
    end`

    const [updated] = await this.db
      .update(messages)
      .set({
        status,
        ...(status === 'read' ? { readAt: new Date() } : {}),
        ...(deliveryError ? { payload: sql`${normalizedPayload} || ${{ deliveryError }}::jsonb` } : {}),
      })
      .where(and(eq(messages.companyId, companyId), eq(messages.waMessageId, waMessageId)))
      .returning()
    return updated
  }

  /**
   * Grava a transcrição endereçando pelo id da Meta, para quem só tem esse.
   *
   * Serve ao caso em que a transcrição acontece no próprio webhook — o grafo precisa do texto para
   * responder ao cliente, e jogar fora o que ele já pagou para transcrever significaria transcrever
   * o mesmo áudio uma segunda vez só para o painel ver.
   *
   * Devolve `undefined` quando não achou a mensagem: entrega duplicada e mensagem apagada são
   * corridas normais, não erro.
   */
  async saveTranscriptionByWaMessageId(params: SaveTranscriptionByWaMessageIdParams): Promise<MessageRow | undefined> {
    const [updated] = await this.db
      .update(messages)
      .set({
        transcriptionStatus: params.status,
        ...(params.text !== undefined ? { transcriptionText: params.text } : {}),
        ...(params.language !== undefined ? { transcriptionLanguage: params.language } : {}),
        ...(params.engine !== undefined ? { transcriptionEngine: params.engine } : {}),
      })
      .where(and(eq(messages.companyId, params.companyId), eq(messages.waMessageId, params.waMessageId)))
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
