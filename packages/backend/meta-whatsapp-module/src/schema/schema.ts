import { sql } from 'drizzle-orm'
import {
  pgSchema,
  uuid,
  varchar,
  jsonb,
  timestamp,
  text,
  integer,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

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
    // Posição no grafo, quando o motor de fluxo está em uso — colunas separadas em vez de
    // convencionar "flowKey:nodeId" dentro de currentState: além de ser um contrato implícito que
    // nada garantia, a concatenação estourava o varchar(64) (flow key já é varchar(64) sozinha).
    flowKey: varchar('flow_key', { length: 64 }),
    currentNodeId: varchar('current_node_id', { length: 64 }),
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
    // Alimenta getLiveFlowPositions (agregação por nó do grafo).
    index('idx_sessions_company_flow_node').on(table.companyId, table.flowKey, table.currentNodeId),
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
    // Parcial e ÚNICO: é o que de fato garante idempotência de entrega. Um SELECT-antes-de-INSERT
    // não basta — a Meta reenvia a mesma entrega e várias instâncias do host processam em
    // paralelo, então as duas passariam pela checagem e inseririam duplicado. Parcial porque
    // mensagens outbound ainda sem waMessageId (envio em curso) são legitimamente NULL, e NULLs
    // não podem competir entre si por unicidade.
    uniqueIndex('idx_messages_company_wa_message_id')
      .on(table.companyId, table.waMessageId)
      .where(sql`${table.waMessageId} is not null`),
  ],
)

// T4.1 — um grafo por fluxo de conversa. `nodes` guarda o Record<string, FlowNodeData> inteiro
// como jsonb (mesmo shape do editor visual em conversations-ui/flows) — não normalizado em
// linhas, porque o grafo é sempre lido/escrito como uma unidade pelo editor e pelo interpretador.
export const flowGraphs = metaWhatsAppSchema.table(
  'flow_graphs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    key: varchar('key', { length: 64 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    startNodeId: varchar('start_node_id', { length: 64 }).notNull(),
    nodes: jsonb('nodes').$type<Record<string, unknown>>().notNull().default({}),
    // Otimista: o editor manda a versão que carregou; salvar com versão desatualizada é
    // rejeitado pelo host (evita duas abas sobrescreverem uma a outra silenciosamente).
    version: integer('version').notNull().default(1),
    showInMenu: boolean('show_in_menu').notNull().default(false),
    menuOptionLabel: varchar('menu_option_label', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_flow_graphs_company_key').on(table.companyId, table.key)],
)

// T5.5 — configuração de WhatsApp POR EMPRESA, em tabela do módulo. Deliberadamente separada do
// app_config genérico do host: são chaves que só o módulo entende, e mantê-las aqui é o que
// permite instalar/remover a capacidade sem migrar a tabela de configuração do produto.
export const settings = metaWhatsAppSchema.table('settings', {
  companyId: uuid('company_id').primaryKey(),
  templateName: varchar('template_name', { length: 128 }),
  templateLanguage: varchar('template_language', { length: 16 }).notNull().default('pt_BR'),
  // Mapa posicional {{1}}, {{2}}... → token resolvido no envio (ex.: '{clientName}').
  templateVariables: jsonb('template_variables').$type<string[]>().notNull().default([]),
  welcomeMessage: text('welcome_message'),
  farewellMessage: text('farewell_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SettingsRow = typeof settings.$inferSelect
export type NewSettingsRow = typeof settings.$inferInsert

export type SessionRow = typeof sessions.$inferSelect
export type NewSessionRow = typeof sessions.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
export type FlowGraphRow = typeof flowGraphs.$inferSelect
export type NewFlowGraphRow = typeof flowGraphs.$inferInsert
