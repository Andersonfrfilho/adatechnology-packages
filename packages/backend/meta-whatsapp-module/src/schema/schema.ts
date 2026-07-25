import { pgSchema, uuid, varchar, jsonb, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core'

// Schema Postgres dedicado (T3.1/T3.5) — o módulo nunca escreve no schema `public` do host,
// só ocupa este namespace próprio. O banco continua sendo um por produto; isto é apenas um
// namespace dentro dele (ver rules/packages/pluggable-module.md §3).
export const metaWhatsAppSchema = pgSchema('meta_whatsapp')

export const sessions = metaWhatsAppSchema.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Multiempresa: toda entidade carrega companyId, vindo do contexto autenticado do host —
    // nunca de um campo livre do cliente (ver database.md "Consistência e multiempresa").
    companyId: uuid('company_id').notNull(),
    whatsappNumber: varchar('whatsapp_number', { length: 20 }).notNull(),
    // varchar (não enum): a máquina de estados de cada produto evolui de forma independente do módulo.
    currentState: varchar('current_state', { length: 64 }).notNull().default('start'),
    context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
    mode: varchar('mode', { length: 12 }).notNull().default('bot'), // bot | human
    assignedUserId: uuid('assigned_user_id'),
    humanRequestedAt: timestamp('human_requested_at', { withTimezone: true }),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    lastAgentReadAt: timestamp('last_agent_read_at', { withTimezone: true }),
    lastActivity: timestamp('last_activity', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Único por empresa (não globalmente) — dois hosts diferentes podem atender o mesmo número.
    uniqueIndex('idx_sessions_company_number').on(table.companyId, table.whatsappNumber),
    index('idx_sessions_company_mode').on(table.companyId, table.mode),
  ],
)

export const messages = metaWhatsAppSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    whatsappNumber: varchar('whatsapp_number', { length: 20 }).notNull(),
    direction: varchar('direction', { length: 12 }).notNull(), // inbound | outbound
    sender: varchar('sender', { length: 12 }).notNull(), // customer | bot | agent
    agentUserId: uuid('agent_user_id'),
    type: varchar('type', { length: 16 }).notNull().default('text'),
    content: text('content'),
    // T5.4 — nunca base64 aqui; mídia vive no ObjectStorageInterface do host, referenciada por
    // uploadId dentro deste jsonb.
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    waMessageId: varchar('wa_message_id', { length: 128 }),
    status: varchar('status', { length: 16 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_messages_session_created').on(table.sessionId, table.createdAt),
    index('idx_messages_company_number_created').on(table.companyId, table.whatsappNumber, table.createdAt),
    index('idx_messages_wa_message_id').on(table.waMessageId),
  ],
)

export type SessionRow = typeof sessions.$inferSelect
export type NewSessionRow = typeof sessions.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
