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

export { ConversationRepository } from './repositories/ConversationRepository'
export { MessageRepository } from './repositories/MessageRepository'
export { AttachmentRepository } from './repositories/AttachmentRepository'
export { ReadRepository } from './repositories/ReadRepository'
export { UnassignedRepository } from './repositories/UnassignedRepository'
export { QuickReplyRepository } from './repositories/QuickReplyRepository'
export type {
  ConversationRepositoryPort,
  MessageRepositoryPort,
  AttachmentRepositoryPort,
  ReadRepositoryPort,
  UnassignedRepositoryPort,
  QuickReplyRepositoryPort,
  FindConversationBySubjectParams,
  FindOpenConversationByParticipantParams,
  FindParticipantParams,
  FindMessageByProviderIdParams,
  UpdateMessageStatusParams,
  ListConversationMessagesParams,
  ListConversationMessagesPage,
  UpsertConversationReadParams,
  FindUnassignedByProviderIdParams,
  ListOpenUnassignedParams,
  AssignUnassignedParams,
} from './repositories/ports'

export { createConversationModule } from './ConversationModule'
export type {
  ConversationModule,
  ConversationModuleConfig,
  ConversationModuleFeatures,
  ConversationModuleProviders,
  CreateConversationModuleParams,
} from './ConversationModule'

export { OpenConversationUseCase } from './use-cases/Conversation.use-cases'
export type { OpenConversationInput } from './use-cases/Conversation.use-cases'
export {
  ListConversationMessagesUseCase,
  ReceiveMessageUseCase,
  SendMessageUseCase,
  UpdateMessageStatusUseCase,
} from './use-cases/Message.use-cases'
export type {
  ListConversationMessagesInput,
  ReceiveMessageInput,
  SendMessageInput,
  UpdateMessageStatusInput,
} from './use-cases/Message.use-cases'
export { MarkConversationReadUseCase } from './use-cases/Read.use-cases'
export type { MarkConversationReadInput } from './use-cases/Read.use-cases'

export {
  AttributeInboundMessageUseCase,
  AssignUnassignedToConversationUseCase,
} from './use-cases/Attribution.use-cases'
export type {
  AttributeInboundMessageInput,
  AttributeInboundMessageResult,
  AssignUnassignedToConversationInput,
  AssignUnassignedToConversationResult,
} from './use-cases/Attribution.use-cases'
export type { FilterConversationCandidatesInput, FilterConversationCandidatesPort } from './use-cases/Attribution.types'

export {
  RequestAttachmentUploadUseCase,
  LinkAttachmentUploadsUseCase,
  CreateAttachmentDownloadUrlUseCase,
  ATTACHMENT_UPLOAD_EXPIRES_IN_SECONDS,
  ATTACHMENT_DOWNLOAD_EXPIRES_IN_SECONDS,
} from './use-cases/Attachment.use-cases'
export type {
  RequestAttachmentUploadInput,
  RequestAttachmentUploadResult,
  LinkAttachmentUploadsInput,
  CreateAttachmentDownloadUrlInput,
  CreateAttachmentDownloadUrlResult,
} from './use-cases/Attachment.use-cases'

export {
  attachmentKindOf,
  matchesAttachmentSignature,
  normalizeAttachmentFileName,
  ATTACHMENT_CONTENT_TYPE_KINDS,
  ATTACHMENT_FILE_NAME_MAX_LENGTH,
} from './domain/attachmentType'

export {
  ConversationModuleError,
  CONVERSATION_ERROR_CODES,
  ChannelPortNotConfiguredError,
  ConversationNotFoundError,
  MessageNotFoundError,
  ConfigMissingError,
  AttachmentsDisabledError,
  AttachmentTypeMismatchError,
  AttachmentTooLargeError,
  UploadNotFoundError,
  UploadExpiredError,
  UnassignedNotFoundError,
  AttachmentNotFoundError,
} from './errors'

export { buildReplyAddress, deriveReplyToken, hashReplyToken, verifyReplyToken } from './domain/replyToken'
export type { BuildReplyAddressInput, DeriveReplyTokenInput, VerifyReplyTokenInput } from './domain/replyToken'

export { EMAIL_THREADING_REFERENCES_MAX_COUNT, buildEmailThreadingHeaders } from './domain/emailThreading'
export type {
  BuildEmailThreadingHeadersInput,
  EmailThreadingHeaders,
  LastInboundEmailMessage,
} from './domain/emailThreading'

export { computeRawEmailSha256 } from './domain/rawEmail'

export { parseEmailMime } from './domain/emailMime'
export type { ParsedEmailAttachment, ParsedEmailMime } from './domain/emailMime'

export { createDkimVerifier, resolveDkimAlignment } from './domain/dkim'
export type { CreateDkimVerifierInput, DkimDnsResolver, DkimSignatureVerification, DkimVerifier } from './domain/dkim'
