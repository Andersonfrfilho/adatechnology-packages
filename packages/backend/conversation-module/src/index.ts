/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Superfície principal do módulo (T202: schema e migrations; casos de uso e portas chegam nas
 * tasks seguintes da Fase 2).
 */

export type { ConversationDatabase, ConversationTransaction, DrizzleMigrateFunction } from './database.types'

export { runConversationMigrations, conversationMigrationsFolder, CONVERSATION_MIGRATIONS_TABLE } from './runMigrations'
export type { RunConversationMigrationsParams } from './runMigrations'

export {
  CONVERSATION_SCHEMA_NAME,
  conversations,
  conversationParticipants,
  conversationMessages,
  conversationAttachments,
  conversationReads,
  conversationUnassigned,
  conversationQuickReplies,
  conversationUploads,
  CONVERSATION_QUICK_REPLY_MAX_LENGTH,
  CONVERSATION_UPLOAD_STATUS,
} from './schema/schema'
export type {
  ConversationRow,
  NewConversationRow,
  ConversationParticipantRow,
  NewConversationParticipantRow,
  ConversationMessageRow,
  NewConversationMessageRow,
  ConversationAttachmentRow,
  NewConversationAttachmentRow,
  ConversationReadRow,
  NewConversationReadRow,
  ConversationUnassignedRow,
  NewConversationUnassignedRow,
  ConversationQuickReplyRow,
  NewConversationQuickReplyRow,
  ConversationUploadRow,
  NewConversationUploadRow,
  ConversationUploadStatus,
} from './schema/schema'
