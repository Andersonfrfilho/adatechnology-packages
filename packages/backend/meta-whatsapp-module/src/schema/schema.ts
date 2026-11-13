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
import type { TranscriptionMode, TranscriptionStatus } from '../transcription.types'

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
    // 32, não 16: os tipos da própria Meta são curtos ('text', 'interactive'), mas o host rotula
    type:
      // a saída com o subtipo que enviou ('interactive_buttons' já tem 19). Apertar aqui só
      // transfere para o consumidor a escolha entre truncar o rótulo e estourar o insert.
      varchar('type', { length: 32 }).notNull().default('text'),
    content: text('content'),
    // T5.4 — nunca base64 aqui; mídia vive no ObjectStorageInterface do host, referenciada por
    // uploadId dentro deste jsonb.
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    waMessageId: varchar('wa_message_id', { length: 128 }),
    status: varchar('status', { length: 16 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    // Moderação de conteúdo. `null` significa NÃO AVALIADO (moderação desligada, ou mensagem
    // anterior ao recurso) — diferente de `false`, que é avaliado e limpo. Colunas em vez de chave
    // dentro de `payload` porque "listar o que foi sinalizado" é consulta de operação, e índice
    // parcial sobre boolean resolve isso sem cavar jsonb.
    moderationFlagged: boolean('moderation_flagged'),
    moderationTerms: jsonb('moderation_terms').$type<string[]>(),
    /**
     * Transcrição de áudio. `null` em `transcription_status` significa NÃO AVALIADO — áudio nunca
     * pedido (modo sob demanda), transcrição desligada, mensagem anterior ao recurso, ou mensagem
     * que não é áudio. Diferente de `'done'` com texto vazio, que é áudio em silêncio já processado
     * e que NÃO deve ser reprocessado.
     *
     * Colunas em vez de chave em `payload` pelo mesmo motivo da moderação: "quais áudios ficaram
     * pendentes" e "quais falharam" são consultas de operação, e índice parcial resolve sem cavar
     * jsonb. Buscar texto de áudio também deixa de exigir varredura de payload.
     */
    transcriptionStatus: varchar('transcription_status', { length: 16 }).$type<TranscriptionStatus>(),
    transcriptionText: text('transcription_text'),
    transcriptionLanguage: varchar('transcription_language', { length: 32 }),
    /** Qual engine produziu. Com uma cadeia de engines, é o que responde "por que esta saiu ruim". */
    transcriptionEngine: varchar('transcription_engine', { length: 32 }),
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
    // Parcial: só as sinalizadas entram, então o índice fica do tamanho do problema e não do
    // tamanho do transcript.
    index('idx_messages_moderation_flagged')
      .on(table.companyId, table.createdAt)
      .where(sql`${table.moderationFlagged}`),
    // Alimenta a varredura de retomada: "quais áudios ficaram pendentes de transcrição". Parcial
    // porque pendente é estado transitório e raro — o índice fica do tamanho da fila atrasada, não
    // do transcript inteiro.
    index('idx_messages_transcription_pending')
      .on(table.companyId, table.createdAt)
      .where(sql`${table.transcriptionStatus} = 'pending'`),
  ],
)

/**
 * Biblioteca de arquivos da conversa.
 *
 * Tabela própria, e não derivada de `messages.payload`: o painel precisa de `source` e `linkedAt`,
 * que não existem no payload; busca por nome de arquivo quer índice, não varredura de jsonb; e
 * `messageId` anulável é o que permite o atendente anexar documento à conversa sem que exista uma
 * mensagem correspondente.
 *
 * `sessionId` em cascata apaga a LINHA junto com a conversa, mas não o binário no storage — quem
 * apaga objeto é passo de aplicação (listar `uploadId` → apagar no storage → apagar a sessão).
 * Confiar só na FK deixaria objeto órfão sendo cobrado para sempre.
 */
export const documents = metaWhatsAppSchema.table(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    // Anulável e `set null`: apagar a mensagem não deve apagar o arquivo da biblioteca, e arquivo
    // do atendente nasce sem mensagem.
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    uploadId: varchar('upload_id', { length: 256 }).notNull(),
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Do provider de storage, que é endereçado por conteúdo — serve para reconciliar storage
    // contra tabela e para detectar o mesmo binário chegando duas vezes.
    sha256: varchar('sha256', { length: 64 }),
    source: varchar('source', { length: 12 }).notNull(), // customer | agent | bot
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_documents_session_linked').on(table.sessionId, table.linkedAt),
    // Para varredura de retenção por idade sem passar por sessão.
    index('idx_documents_company_linked').on(table.companyId, table.linkedAt),
    // O mesmo objeto não pode ser linkado duas vezes na mesma empresa: o job de ingestão é
    // reentregue por retry, e sem isto a reentrega criaria linha duplicada no painel.
    uniqueIndex('idx_documents_company_upload').on(table.companyId, table.uploadId),
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

/**
 * Biblioteca de mídia do bot: arquivos que um nó `action` de `send_media` dispara ao chegar nele.
 *
 * Tabela separada de `documents` de propósito, e não por simetria: `documents` é o acervo DE UMA
 * CONVERSA (tem `sessionId` obrigatório) e tem índice único em (companyId, uploadId), porque lá o
 * mesmo binário chegando duas vezes é reentrega de job. Aqui é o oposto — o mesmo arquivo é
 * enviado para todo cliente que passar pelo nó, então aquele único bloquearia o segundo envio.
 *
 * Sem FK para `flow_graphs.id`: o vínculo natural é (companyId, flowKey), que é justamente o
 * índice único de lá. `nodeId` não tem como ser FK — nós vivem dentro do jsonb `nodes` — então
 * apagar um nó no editor deixa a linha órfã; quem lista sempre parte de um nó existente, e a
 * limpeza é passo de aplicação ao salvar o grafo.
 */
export const flowMedia = metaWhatsAppSchema.table(
  'flow_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id').notNull(),
    flowKey: varchar('flow_key', { length: 64 }).notNull(),
    nodeId: varchar('node_id', { length: 64 }).notNull(),
    uploadId: varchar('upload_id', { length: 256 }).notNull(),
    filename: varchar('filename', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Legenda da mídia no WhatsApp. Por arquivo, não por nó: um nó que manda tabela de preços e
    // um folder precisa de textos diferentes para cada um.
    caption: text('caption'),
    // Ordem de envio dentro do nó — o cliente recebe as mensagens em sequência, e "tabela antes
    // do folder" é decisão de quem edita, não do banco.
    sortOrder: integer('sort_order').notNull().default(0),
    // Desligar sem desanexar: trocar o material da campanha é o caso comum, e apagar a linha
    // perderia a ordem e a legenda já ajustadas.
    active: boolean('active').notNull().default(true),
    // Id do arquivo já subido para a Meta, por número remetente. Sem isto, o MESMO binário subia de
    // novo para cada cliente que passava pelo nó: a Meta aceita reusar o id por 30 dias.
    //
    // Mapa por `phone_number_id`, e não coluna única: o id é escopado ao número que envia, e uma
    // instalação com dois números mandaria o id de um pelo outro. A validade não é gravada de
    // propósito — confiar em "30 dias" calculados erra nos casos de borda, e quem decide é a
    // recusa da Meta, que devolve ao caminho de subir o binário.
    metaMediaIds: jsonb('meta_media_ids').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_flow_media_node').on(table.companyId, table.flowKey, table.nodeId, table.sortOrder),
    // O mesmo arquivo anexado duas vezes ao MESMO nó é erro de clique no editor, e o cliente
    // receberia o documento repetido.
    uniqueIndex('idx_flow_media_node_upload').on(table.companyId, table.flowKey, table.nodeId, table.uploadId),
  ],
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
  /**
   * Política de transcrição desta empresa. Nulo é significativo: "o painel não decidiu", e aí vale
   * o padrão que o host injetou. Sem a distinção, atualizar o módulo desligaria a transcrição de
   * quem já a tinha ligada por ambiente.
   */
  transcriptionEnabled: boolean('transcription_enabled'),
  transcriptionMode: varchar('transcription_mode', { length: 16 }).$type<TranscriptionMode>(),
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
export type DocumentRow = typeof documents.$inferSelect
export type NewDocumentRow = typeof documents.$inferInsert
export type FlowMediaRow = typeof flowMedia.$inferSelect
export type NewFlowMediaRow = typeof flowMedia.$inferInsert
