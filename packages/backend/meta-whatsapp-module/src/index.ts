export { createMetaWhatsAppModule } from './createMetaWhatsAppModule'
export type {
  MetaWhatsAppModule,
  CreateMetaWhatsAppModuleParams,
  MetaWhatsAppModuleConfig,
  MetaWhatsAppModuleFeatures,
  MetaWhatsAppModuleProviders,
} from './createMetaWhatsAppModule'

export { metaWhatsAppSchema, sessions, messages, flowGraphs, settings } from './schema/schema'
export type {
  SessionRow,
  NewSessionRow,
  MessageRow,
  NewMessageRow,
  FlowGraphRow,
  NewFlowGraphRow,
  SettingsRow,
  NewSettingsRow,
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

export { SettingsRepository } from './repositories/SettingsRepository'
export { SendMessageUseCase } from './use-cases/SendMessage.use-case'
export type { SendTextParams, SendMediaParams, SendTemplateParams } from './use-cases/SendMessage.use-case'

export { runMetaWhatsAppMigrations } from './runMigrations'

export { SessionRepository } from './repositories/SessionRepository'
export type { ListConversationsFilters } from './repositories/SessionRepository'
export { MessageRepository } from './repositories/MessageRepository'
export type {
  InsertMessageParams,
  ListMessagesParams as RepositoryListMessagesParams,
} from './repositories/MessageRepository'

export { SseHub, issueSseTicket, redeemSseTicket } from './realtime/SseHub'
export type { SseListener, TicketStoreInterface, RealtimeRelay } from './realtime/SseHub'

export { FlowGraphRepository, OptimisticLockError } from './repositories/FlowGraphRepository'
export { FlowInterpreter } from './flows/FlowInterpreter'
export type { FlowStepInput, FlowStepResult, FlowRunResult } from './flows/FlowInterpreter'

export { TakeoverConversationUseCase } from './use-cases/TakeoverConversation.use-case'
export type { TakeoverConversationParams } from './use-cases/TakeoverConversation.use-case'
export { ReleaseConversationUseCase } from './use-cases/ReleaseConversation.use-case'
export type { ReleaseConversationParams } from './use-cases/ReleaseConversation.use-case'
export { LogMessageUseCase } from './use-cases/LogMessage.use-case'
export type { LogMessageParams } from './use-cases/LogMessage.use-case'
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
