export { createMetaWhatsAppModule } from './createMetaWhatsAppModule'
export type {
  MetaWhatsAppModule,
  CreateMetaWhatsAppModuleParams,
  MetaWhatsAppModuleConfig,
  MetaWhatsAppModuleFeatures,
  MetaWhatsAppModuleProviders,
} from './createMetaWhatsAppModule'

export { metaWhatsAppSchema, sessions, messages, flowGraphs, settings, documents } from './schema/schema'
export type {
  SessionRow,
  NewSessionRow,
  MessageRow,
  NewMessageRow,
  FlowGraphRow,
  NewFlowGraphRow,
  SettingsRow,
  NewSettingsRow,
  DocumentRow,
  NewDocumentRow,
} from './schema/schema'

export { WhatsAppChannelAdapter } from './channel/WhatsAppChannelAdapter'
export { ReceiveWebhookUseCase } from './channel/ReceiveWebhook.use-case'
export type { ReceiveWebhookParams, ReceiveWebhookResult } from './channel/ReceiveWebhook.use-case'
export {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  claimWebhookDelivery,
  WEBHOOK_NONCE_TTL_SECONDS,
} from './channel/webhookSecurity'
export type { NonceStoreInterface } from './channel/webhookSecurity'

export { IngestInboundMediaUseCase, extractMediaDescriptor } from './channel/IngestInboundMedia.use-case'
export type { IngestInboundMediaParams, IngestInboundMediaResult } from './channel/IngestInboundMedia.use-case'

export { SettingsRepository } from './repositories/SettingsRepository'
export { SendMessageUseCase } from './use-cases/SendMessage.use-case'
export type { SendTextParams, SendMediaParams, SendTemplateParams } from './use-cases/SendMessage.use-case'

export {
  runMetaWhatsAppMigrations,
  metaWhatsAppMigrationsFolder,
  META_WHATSAPP_MIGRATIONS_TABLE,
} from './runMigrations'
export type { RunMetaWhatsAppMigrationsParams } from './runMigrations'
export type { MetaWhatsAppDatabase, DrizzleMigrateFunction } from './database.types'

export { SessionRepository } from './repositories/SessionRepository'
export type { ListConversationsFilters } from './repositories/SessionRepository'
export { MessageRepository } from './repositories/MessageRepository'
export type {
  InsertMessageParams,
  ListMessagesParams as RepositoryListMessagesParams,
} from './repositories/MessageRepository'

export { SseHub, issueSseTicket, redeemSseTicket } from './realtime/SseHub'
export type { SseListener, TicketStoreInterface, RealtimeRelay } from './realtime/SseHub'

export { FlowGraphRepository, OptimisticLockError, InvalidFlowGraphError } from './repositories/FlowGraphRepository'
export { FlowInterpreter } from './flows/FlowInterpreter'
export type { FlowStepInput, FlowStepResult, FlowRunResult } from './flows/FlowInterpreter'

export { TakeoverConversationUseCase } from './use-cases/TakeoverConversation.use-case'
export type { TakeoverConversationParams } from './use-cases/TakeoverConversation.use-case'
export { ReleaseConversationUseCase } from './use-cases/ReleaseConversation.use-case'
export type { ReleaseConversationParams } from './use-cases/ReleaseConversation.use-case'
export { LogMessageUseCase } from './use-cases/LogMessage.use-case'
export type { LogMessageParams, MessageModerator } from './use-cases/LogMessage.use-case'
export { DocumentRepository } from './repositories/DocumentRepository'
export type { LinkDocumentParams, ListDocumentsParams, ListDocumentsResult } from './repositories/DocumentRepository'
export { DeleteConversationUseCase } from './use-cases/DeleteConversation.use-case'
export type { DeleteConversationParams, DeleteConversationResult } from './use-cases/DeleteConversation.use-case'
export { PurgeExpiredDocumentsUseCase } from './use-cases/PurgeExpiredDocuments.use-case'
export type {
  PurgeExpiredDocumentsParams,
  PurgeExpiredDocumentsResult,
} from './use-cases/PurgeExpiredDocuments.use-case'
export { ListConversationDocumentsUseCase } from './use-cases/ListConversationDocuments.use-case'
export { ListCompanyDocumentsUseCase } from './use-cases/ListCompanyDocuments.use-case'
export type {
  ListCompanyDocumentsParams,
  CompanyDocumentView,
  CompanyDocumentsPage,
} from './use-cases/ListCompanyDocuments.use-case'
export type {
  ListConversationDocumentsParams,
  ConversationDocumentView,
  ConversationDocumentsPage,
} from './use-cases/ListConversationDocuments.use-case'
export { ListConversationsUseCase } from './use-cases/ListConversations.use-case'
export type { ListConversationsParams } from './use-cases/ListConversations.use-case'
export { ListMessagesUseCase } from './use-cases/ListMessages.use-case'
export type { ListMessagesParams } from './use-cases/ListMessages.use-case'
export { ExportConversationUseCase } from './use-cases/ExportConversation.use-case'
export type { ExportConversationParams, ExportConversationResult } from './use-cases/ExportConversation.use-case'

export {
  GetFlowGraphUseCase,
  ListFlowGraphsUseCase,
  CreateFlowGraphUseCase,
  SaveFlowGraphUseCase,
  DeleteFlowGraphUseCase,
  GetLiveFlowPositionsUseCase,
} from './use-cases/FlowGraph.use-cases'
export type { CreateFlowGraphParams, SaveFlowGraphParams } from './use-cases/FlowGraph.use-cases'
