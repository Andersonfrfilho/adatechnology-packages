/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O núcleo de conversa (spec 211, ADR-0085): schema Postgres próprio (`conversation`), extraído do
 * produto de origem sem nenhum conceito de domínio dele — o assunto é o par opaco `subject_type`/
 * `subject_id` (D1), e nenhuma FK sai do módulo (RNF3, RNF4): `company_id` vem sempre do contexto
 * autenticado do host, nunca de FK para uma tabela de empresas dele.
 *
 * ⚠️ A conversa não decide (D4 herdado da 183): nenhuma coluna aqui é lida por regra de negócio do
 * host — isso é responsabilidade de quem consome o módulo.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  CHANNEL_CAPABILITIES,
  CONVERSATION_CHANNEL,
  ATTACHMENT_KIND,
  DKIM_RESULT,
} from '@adatechnology/conversation-contracts'

/** Renders a literal enumeration for an `in (...)` check constraint. */
function inList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ')
}

export const CONVERSATION_SCHEMA_NAME = 'conversation'
export const conversationSchema = pgSchema(CONVERSATION_SCHEMA_NAME)

export const CONVERSATION_STATUSES = ['open', 'closed'] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

export const conversations = conversationSchema.table(
  'conversations',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    /** D1: par opaco, anulável — preenchido é conversa por assunto, nulo é conversa por pessoa. */
    subjectType: text('subject_type'),
    subjectId: text('subject_id'),
    /** Rótulo opaco do produto: com quem é a conversa (ex. 'customer'). Nunca validado aqui. */
    audience: text(),
    /**
     * Referência opaca exposta a canal externo (ex. o portal do host). A origem (spec 183) era
     * única na instalação inteira; como o módulo é multi-tenant por desenho, o unique fica
     * `(company_id, public_ref)` para satisfazer a regra "todo unique começa por company_id" — o
     * host que precisar de unicidade além da própria empresa garante isso na composição dele.
     */
    publicRef: text('public_ref'),
    status: text().$type<ConversationStatus>().notNull().default('open'),
    defaultChannel: text('default_channel'),
    /** O início da janela de canal cujo aviso de expiração já saiu (idempotência do host). */
    windowNoticeSentFor: timestamp('window_notice_sent_for', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('conversations_company_id_id_unique').on(table.companyId, table.id),
    unique('conversations_company_id_public_ref_unique').on(table.companyId, table.publicRef),
    /** Uma conversa por (assunto, público) — só vale enquanto há assunto; a conversa por pessoa (sem assunto) não tem chave no banco. */
    uniqueIndex('conversations_subject_audience_unique')
      .on(table.companyId, table.subjectType, table.subjectId, sql`coalesce(${table.audience}, '')`)
      .where(sql`${table.subjectType} is not null`),
    check('conversations_status_check', sql`${table.status} in (${sql.raw(inList(CONVERSATION_STATUSES))})`),
    check(
      'conversations_default_channel_check',
      sql`${table.defaultChannel} is null or ${table.defaultChannel} in (${sql.raw(inList(CONVERSATION_CHANNEL))})`,
    ),
    /** O assunto só existe inteiro ou ausente — nunca um dos dois sozinho. */
    check('conversations_subject_pair_check', sql`(${table.subjectType} is null) = (${table.subjectId} is null)`),
    check(
      'conversations_public_ref_check',
      sql`${table.publicRef} is null or ${table.publicRef} ~ '^[A-Za-z0-9_-]{22,64}$'`,
    ),
  ],
)

export const conversationParticipants = conversationSchema.table(
  'participants',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    channel: text().notNull(),
    identifier: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('participants_company_id_conversation_id_channel_identifier_unique').on(
      table.companyId,
      table.conversationId,
      table.channel,
      table.identifier,
    ),
    foreignKey({
      columns: [table.companyId, table.conversationId],
      foreignColumns: [conversations.companyId, conversations.id],
      name: 'participants_conversation_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check('participants_channel_check', sql`${table.channel} in (${sql.raw(inList(CONVERSATION_CHANNEL))})`),
  ],
)

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const MESSAGE_STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed', 'bounced'] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export const conversationMessages = conversationSchema.table(
  'messages',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    channel: text().notNull(),
    direction: text().$type<MessageDirection>().notNull(),
    /** Usuário do host: operador na enviada; conta do app/portal na recebida. Sem FK. */
    authorUserId: uuid('author_user_id'),
    /** A mensagem automática que o host manda sozinho (ex. aviso do tipo do assunto). */
    automatic: boolean().notNull().default(false),
    /** Como chegou (endereço/número), histórico imutável. Nunca vai a log. */
    senderAddress: text('sender_address'),
    bodyText: text('body_text').notNull().default(''),
    /** Só a enviada tem status de entrega; a recebida tem a leitura por usuário (tabela `reads`). */
    status: text().$type<MessageStatus>(),
    statusTimes: jsonb('status_times').$type<Record<string, string>>().notNull().default({}),
    providerMessageId: text('provider_message_id'),
    /** Referência opaca ao registro do transporte do host (ex. a mensagem de e-mail dele). */
    transportRef: text('transport_ref'),
    dkimResult: text('dkim_result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('messages_company_id_id_unique').on(table.companyId, table.id),
    /** O status do provedor é idempotente pelo id dele, dentro do canal. */
    unique('messages_company_id_channel_provider_message_id_unique').on(
      table.companyId,
      table.channel,
      table.providerMessageId,
    ),
    foreignKey({
      columns: [table.companyId, table.conversationId],
      foreignColumns: [conversations.companyId, conversations.id],
      name: 'messages_conversation_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check('messages_channel_check', sql`${table.channel} in (${sql.raw(inList(CONVERSATION_CHANNEL))})`),
    check('messages_direction_check', sql`${table.direction} in (${sql.raw(inList(MESSAGE_DIRECTIONS))})`),
    /**
     * Enviada: exatamente um de autor/automática, e nunca `sender_address`. Recebida: não
     * automática, exatamente um de autor/remetente — autor só em canal com conta do host
     * (`app|portal|webchat`), remetente só em canal externo (`email|whatsapp|webchat`).
     */
    check(
      'messages_author_check',
      sql`(${table.direction} = 'outbound' and (${table.authorUserId} is not null) <> ${table.automatic} and ${table.senderAddress} is null)
        or (${table.direction} = 'inbound' and not ${table.automatic} and num_nonnulls(${table.authorUserId}, ${table.senderAddress}) = 1
          and (${table.authorUserId} is null or ${table.channel} in ('app', 'portal', 'webchat'))
          and (${table.senderAddress} is null or ${table.channel} in ('email', 'whatsapp', 'webchat')))`,
    ),
    check(
      'messages_status_check',
      sql`${table.status} is null or ${table.status} in (${sql.raw(inList(MESSAGE_STATUSES))})`,
    ),
    check('messages_status_direction_check', sql`(${table.direction} = 'outbound') = (${table.status} is not null)`),
    /** D6/143: DKIM só existe no e-mail recebido; a verificação nunca se refaz depois. */
    check(
      'messages_dkim_result_check',
      sql`${table.dkimResult} is null or (${table.dkimResult} in (${sql.raw(inList(DKIM_RESULT))}) and ${table.channel} = 'email' and ${table.direction} = 'inbound')`,
    ),
    check('messages_body_length_check', sql`length(${table.bodyText}) <= 8000`),
    /**
     * RF2: um CHECK por canal, gerado a partir da tabela de capacidades — nunca uma lista escrita
     * à mão. É o que garante que o schema nunca aceite um status que o canal não alcança.
     */
    ...CONVERSATION_CHANNEL.map((channel) =>
      check(
        `messages_${channel}_reachable_status_check`,
        // O canal entra como literal (`sql.raw`), nunca como parâmetro de bind: DDL não aceita
        // `$1` — o Postgres recusa `CHECK` com parâmetro, porque a constraint não tem plano de
        // execução parametrizável (achado T202, corrigido com o mesmo `inList` das outras CHECKs).
        sql`${table.channel} <> ${sql.raw(`'${channel}'`)} or ${table.status} is null or ${table.status} in (${sql.raw(inList(CHANNEL_CAPABILITIES[channel].reachableStatuses))})`,
      ),
    ),
    index('messages_conversation_created_idx').on(table.companyId, table.conversationId, table.createdAt, table.id),
  ],
)

export const conversationAttachments = conversationSchema.table(
  'attachments',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    messageId: uuid('message_id').notNull(),
    bucket: text().notNull(),
    objectKey: text('object_key').notNull(),
    sha256: text().notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    contentType: text('content_type').notNull(),
    kind: text().notNull(),
    /** Nome para quem lê baixar; nunca vai a log. */
    fileName: text('file_name').notNull().default(''),
    durationMs: integer('duration_ms'),
    /** Ausente = não avaliado; nunca texto fingido quando a transcrição está desligada. */
    transcriptText: text('transcript_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('attachments_company_id_id_unique').on(table.companyId, table.id),
    foreignKey({
      columns: [table.companyId, table.messageId],
      foreignColumns: [conversationMessages.companyId, conversationMessages.id],
      name: 'attachments_message_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check('attachments_sha256_check', sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check('attachments_size_check', sql`${table.sizeBytes} > 0`),
    check('attachments_kind_check', sql`${table.kind} in (${sql.raw(inList(ATTACHMENT_KIND))})`),
    check('attachments_duration_check', sql`${table.durationMs} is null or ${table.durationMs} > 0`),
    index('attachments_message_idx').on(table.companyId, table.messageId),
  ],
)

export const conversationReads = conversationSchema.table(
  'reads',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    userId: uuid('user_id').notNull(),
    lastReadMessageId: uuid('last_read_message_id').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('reads_company_id_conversation_id_user_id_unique').on(table.companyId, table.conversationId, table.userId),
    foreignKey({
      columns: [table.companyId, table.conversationId],
      foreignColumns: [conversations.companyId, conversations.id],
      name: 'reads_conversation_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    foreignKey({
      columns: [table.companyId, table.lastReadMessageId],
      foreignColumns: [conversationMessages.companyId, conversationMessages.id],
      name: 'reads_message_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
  ],
)

export const conversationUnassigned = conversationSchema.table(
  'unassigned',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    channel: text().notNull(),
    senderAddress: text('sender_address').notNull(),
    bodyText: text('body_text').notNull().default(''),
    providerMessageId: text('provider_message_id'),
    /** Referência opaca ao registro do transporte do host (ex. a mensagem de e-mail dele). */
    transportRef: text('transport_ref'),
    dkimResult: text('dkim_result'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    assignedMessageId: uuid('assigned_message_id'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    assignedByUserId: uuid('assigned_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('unassigned_company_id_id_unique').on(table.companyId, table.id),
    unique('unassigned_company_id_channel_provider_message_id_unique').on(
      table.companyId,
      table.channel,
      table.providerMessageId,
    ),
    foreignKey({
      columns: [table.companyId, table.assignedMessageId],
      foreignColumns: [conversationMessages.companyId, conversationMessages.id],
      name: 'unassigned_assigned_message_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check('unassigned_channel_check', sql`${table.channel} in (${sql.raw(inList(CONVERSATION_CHANNEL))})`),
    /** Atribuída tem os três juntos: a mensagem criada, quando e por quem. Nunca palpite (D7). */
    check(
      'unassigned_assignment_check',
      sql`num_nonnulls(${table.assignedMessageId}, ${table.assignedAt}, ${table.assignedByUserId}) in (0, 3)`,
    ),
    index('unassigned_open_idx')
      .on(table.companyId, table.receivedAt)
      .where(sql`${table.assignedMessageId} is null`),
  ],
)

/** O teto do texto de uma resposta rápida — é um começo de mensagem, não um modelo. */
export const CONVERSATION_QUICK_REPLY_MAX_LENGTH = 500

export const conversationQuickReplies = conversationSchema.table(
  'quick_replies',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    /** Rótulo livre do produto — para quem a resposta é escrita. Nunca validado aqui. */
    audience: text().notNull(),
    bodyText: text('body_text').notNull(),
    position: integer().notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'quick_replies_body_text_check',
      sql`char_length(btrim(${table.bodyText})) between 1 and ${sql.raw(String(CONVERSATION_QUICK_REPLY_MAX_LENGTH))}`,
    ),
    check('quick_replies_position_check', sql`${table.position} >= 0`),
    index('quick_replies_audience_position_idx').on(table.companyId, table.audience, table.position),
  ],
)

export const CONVERSATION_UPLOAD_STATUS = ['pending', 'attached', 'expired'] as const
export type ConversationUploadStatus = (typeof CONVERSATION_UPLOAD_STATUS)[number]

export const conversationUploads = conversationSchema.table(
  'uploads',
  {
    id: uuid().defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    channel: text().notNull(),
    /** Usuário do host que pediu o upload. Sem FK. */
    requestedByUserId: uuid('requested_by_user_id').notNull(),
    bucket: text().notNull(),
    objectKey: text('object_key').notNull(),
    declaredContentType: text('declared_content_type').notNull(),
    declaredSizeBytes: integer('declared_size_bytes').notNull(),
    fileName: text('file_name').notNull().default(''),
    status: text().$type<ConversationUploadStatus>().notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attachedAt: timestamp('attached_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uploads_company_id_object_key_unique').on(table.companyId, table.objectKey),
    foreignKey({
      columns: [table.companyId, table.conversationId],
      foreignColumns: [conversations.companyId, conversations.id],
      name: 'uploads_conversation_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check('uploads_status_check', sql`${table.status} in (${sql.raw(inList(CONVERSATION_UPLOAD_STATUS))})`),
    check('uploads_channel_check', sql`${table.channel} in (${sql.raw(inList(CONVERSATION_CHANNEL))})`),
    check('uploads_size_check', sql`${table.declaredSizeBytes} > 0`),
    check('uploads_file_name_check', sql`char_length(${table.fileName}) <= 200`),
    check('uploads_attached_check', sql`(${table.status} = 'attached') = (${table.attachedAt} is not null)`),
    index('uploads_status_expires_idx').on(table.status, table.expiresAt),
  ],
)

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type ConversationParticipantRow = typeof conversationParticipants.$inferSelect
export type NewConversationParticipantRow = typeof conversationParticipants.$inferInsert
export type ConversationMessageRow = typeof conversationMessages.$inferSelect
export type NewConversationMessageRow = typeof conversationMessages.$inferInsert
export type ConversationAttachmentRow = typeof conversationAttachments.$inferSelect
export type NewConversationAttachmentRow = typeof conversationAttachments.$inferInsert
export type ConversationReadRow = typeof conversationReads.$inferSelect
export type NewConversationReadRow = typeof conversationReads.$inferInsert
export type ConversationUnassignedRow = typeof conversationUnassigned.$inferSelect
export type NewConversationUnassignedRow = typeof conversationUnassigned.$inferInsert
export type ConversationQuickReplyRow = typeof conversationQuickReplies.$inferSelect
export type NewConversationQuickReplyRow = typeof conversationQuickReplies.$inferInsert
export type ConversationUploadRow = typeof conversationUploads.$inferSelect
export type NewConversationUploadRow = typeof conversationUploads.$inferInsert
