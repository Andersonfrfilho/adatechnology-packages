export { createMetaWhatsAppModule } from './createMetaWhatsAppModule'
export type {
  MetaWhatsAppModule,
  CreateMetaWhatsAppModuleParams,
  MetaWhatsAppModuleConfig,
  MetaWhatsAppModuleFeatures,
  MetaWhatsAppModuleProviders,
  MetaWhatsAppTranscriptionConfig,
} from './createMetaWhatsAppModule'

export {
  metaWhatsAppSchema,
  sessions,
  messages,
  flowGraphs,
  settings,
  documents,
  flowMedia,
  quickReplies,
} from './schema/schema'
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
  FlowMediaRow,
  NewFlowMediaRow,
  QuickReplyRow,
  NewQuickReplyRow,
} from './schema/schema'

export { WhatsAppChannelAdapter } from './channel/WhatsAppChannelAdapter'
export { INBOUND_LOCATION_CONTENT } from './inboundLocation.constant'
export { ReceiveWebhookUseCase } from './channel/ReceiveWebhook.use-case'
export type { ReceiveWebhookParams, ReceiveWebhookResult } from './channel/ReceiveWebhook.use-case'
export {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  claimWebhookDelivery,
  confirmWebhookDelivery,
  WEBHOOK_CLAIM_TTL_SECONDS,
  WEBHOOK_NONCE_TTL_SECONDS,
} from './channel/webhookSecurity'
export type { NonceStoreInterface } from './channel/webhookSecurity'

export {
  InboundEffectsDispatcher,
  ProcessInboundDispatchUseCase,
  buildInboundJobId,
  toSessionContract,
} from './channel/inboundDispatch'
export type {
  InboundDispatchJob,
  InboundDispatchQueueInterface,
  InboundMediaDescriptor,
  InboundMessageEffectsJob,
  InboundStatusEffectsJob,
} from './channel/inboundDispatch'

export { IngestInboundMediaUseCase, extractMediaDescriptor } from './channel/IngestInboundMedia.use-case'
export type {
  IngestInboundMediaParams,
  IngestInboundMediaResult,
  IngestTranscriptionOptions,
} from './channel/IngestInboundMedia.use-case'

export { StorePreviewMediaUseCase } from './use-cases/StorePreviewMedia.use-case'
export type { StorePreviewMediaParams, StorePreviewMediaResult } from './use-cases/StorePreviewMedia.use-case'
export { PREVIEW_MEDIA_ID_PREFIX, toPreviewMediaId, resolvePreviewUploadId } from './channel/previewMedia'
export type { PreviewMediaSupport, PreviewContactsSupport } from './channel/WhatsAppChannelAdapter'

export { TranscribeAudioUseCase, resolveFailureStatus } from './use-cases/TranscribeAudio.use-case'
export type {
  TranscribeAudioParams,
  TranscribeAudioResult,
  TranscribeAudioDependencies,
} from './use-cases/TranscribeAudio.use-case'
export { createTranscriptionPolicyResolver } from './use-cases/resolveTranscriptionPolicy'
export type {
  TranscriptionPolicy,
  TranscriptionPolicyDefaults,
  TranscriptionPolicyResolver,
  ResolveTranscriptionPolicyDependencies,
} from './use-cases/resolveTranscriptionPolicy'
export {
  TRANSCRIPTION_MODE,
  TRANSCRIPTION_STATUS,
  isAudioMimeType,
  isRetriableTranscriptionError,
  isUnsupportedTranscriptionError,
  transcriptionRetryAfterSeconds,
} from './transcription.types'
export type { AudioTranscriber, TranscriptionMode, TranscriptionStatus } from './transcription.types'

export { SettingsRepository } from './repositories/SettingsRepository'
export { SendMessageUseCase, DEFAULT_FALLBACK_LIST_LABEL } from './use-cases/SendMessage.use-case'
export type {
  SendTextParams,
  SendMediaParams,
  SendTemplateParams,
  SendInteractiveParams,
} from './use-cases/SendMessage.use-case'

export {
  runMetaWhatsAppMigrations,
  metaWhatsAppMigrationsFolder,
  META_WHATSAPP_MIGRATIONS_TABLE,
} from './runMigrations'
export type {
  RunMetaWhatsAppMigrationsParams,
  MetaWhatsAppMigrationsLayout,
  MetaWhatsAppMigrationsFolderParams,
} from './runMigrations'
export type {
  MetaWhatsAppDatabase,
  MetaWhatsAppDatabaseFor,
  MetaWhatsAppDatabaseShape,
  DrizzleMigrateFunction,
} from './database.types'

export { SessionRepository } from './repositories/SessionRepository'
export type { ListConversationsFilters } from './repositories/SessionRepository'
export { MessageRepository } from './repositories/MessageRepository'
export type {
  InsertMessageParams,
  SaveTranscriptionParams,
  SaveTranscriptionByWaMessageIdParams,
  ListMessagesParams as RepositoryListMessagesParams,
} from './repositories/MessageRepository'

export { SseHub, issueSseTicket, redeemSseTicket } from './realtime/SseHub'
export type { SseListener, TicketStoreInterface, RealtimeRelay } from './realtime/SseHub'

export { FlowGraphRepository, OptimisticLockError, InvalidFlowGraphError } from './repositories/FlowGraphRepository'
export type { ReseedFlowGraphParams, ReseedFlowGraphResult } from './repositories/FlowGraphRepository'
export { FlowInterpreter } from './flows/FlowInterpreter'
export type { FlowStepInput, FlowStepResult, FlowRunResult, FlowRunOptions } from './flows/FlowInterpreter'
export { FlowRunner } from './flows/FlowRunner'
export type { FlowRunnerDependencies, HandleFlowMessageParams, StartFlowParams } from './flows/FlowRunner'
export { FlowHandoff } from './flows/FlowHandoff'
export { PostgresAdvisoryFlowTurnLock, InProcessFlowTurnLock } from './flows/flowTurnLock'
export type { FlowTurnLockInterface, FlowTurnLockKey } from './flows/flowTurnLock'
export { resolveFlowTimeZone } from './flows/FlowRunner'
export { isTransientSendError } from './flows/sendWithRetry'
export { readFlowInbound } from './flows/readFlowInbound'
export type { FlowInbound } from './flows/readFlowInbound'
export type { FlowHandoffDependencies, RequestFlowHandoffParams } from './flows/FlowHandoff'
export type {
  FlowRunnerConfig,
  FlowSendRetryConfig,
  FlowRunnerOutcome,
  FlowGlobalKeyword,
  FlowGlobalKeywordMatch,
  FlowGlobalKeywordTarget,
  FlowHandoffConfig,
  FlowVariablesResolver,
  FlowTextKind,
  FlowTextContext,
  FlowTextResolver,
  FlowConfigText,
  FlowAnswerValidator,
  FlowAnswerValidatorResult,
} from './flows/flowRunner.types'
export { resolveFlowConfigText } from './flows/resolveFlowConfigText'
export {
  DEFAULT_FLOW_TEXT,
  DEFAULT_START_FLOW_KEY,
  DEFAULT_MAX_INVALID_ANSWERS,
  DYNAMIC_CHOICE_MORE_ID,
  FLOW_RUNTIME_CONTEXT_KEY,
} from './flows/flowRunner.constant'
export { buildFlowChoiceMessage } from './flows/buildFlowChoiceMessage'
export type {
  FlowChoiceOption,
  FlowOutboundMessage,
  BuildFlowChoiceMessageParams,
} from './flows/buildFlowChoiceMessage'
export { resolveFlowAnswer, isChoiceNode } from './flows/resolveFlowAnswer'
export type { FlowAnswerDecision, ResolveFlowAnswerParams } from './flows/resolveFlowAnswer'
export { FlowGraphCache, DEFAULT_FLOW_GRAPH_CACHE_TTL_SECONDS } from './repositories/FlowGraphCache'
export { FlowMediaRepository } from './repositories/FlowMediaRepository'
export type {
  FlowMediaLocation,
  AttachFlowMediaParams,
  UpdateFlowMediaParams,
} from './repositories/FlowMediaRepository'
export { createSendProductListAction, PRODUCT_LIST_LIMIT } from './flows/createSendProductListAction'
export type { CreateSendProductListActionParams } from './flows/createSendProductListAction'
export { createSendMediaAction } from './flows/createSendMediaAction'
export { createSendStickerAction, STICKER_MIME_TYPE } from './flows/createSendStickerAction'
export type { CreateSendStickerActionParams, StickerSource } from './flows/createSendStickerAction'
export { FlowMediaIdRepository } from './repositories/FlowMediaIdRepository'
export type {
  CreateSendMediaActionParams,
  FlowMediaIdCache,
  FlowMediaIdStore,
  FlowMediaTranscriptLogger,
} from './flows/createSendMediaAction'

export { TakeoverConversationUseCase } from './use-cases/TakeoverConversation.use-case'
export type { TakeoverConversationParams } from './use-cases/TakeoverConversation.use-case'
export { ReleaseConversationUseCase } from './use-cases/ReleaseConversation.use-case'
export type { ReleaseConversationParams } from './use-cases/ReleaseConversation.use-case'
export { RequestHumanConversationUseCase } from './use-cases/RequestHumanConversation.use-case'
export type { RequestHumanConversationParams } from './use-cases/RequestHumanConversation.use-case'
export { LogMessageUseCase } from './use-cases/LogMessage.use-case'
export type { LogMessageParams, MessageModerator } from './use-cases/LogMessage.use-case'
export { DocumentRepository } from './repositories/DocumentRepository'
export type { LinkDocumentParams, ListDocumentsParams, ListDocumentsResult } from './repositories/DocumentRepository'
export { DeleteConversationUseCase } from './use-cases/DeleteConversation.use-case'
export type { DeleteConversationParams, DeleteConversationResult } from './use-cases/DeleteConversation.use-case'
export { PurgeExpiredDocumentsUseCase } from './use-cases/PurgeExpiredDocuments.use-case'
export {
  CountInboundLocationsUseCase,
  RedactInboundLocationsUseCase,
} from './use-cases/RedactInboundLocations.use-case'
export type {
  CountInboundLocationsParams,
  CountInboundLocationsResult,
  RedactInboundLocationsParams,
  RedactInboundLocationsResult,
} from './use-cases/RedactInboundLocations.use-case'
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
  ReseedFlowGraphUseCase,
  DeleteFlowGraphUseCase,
  GetLiveFlowPositionsUseCase,
} from './use-cases/FlowGraph.use-cases'
export type { CreateFlowGraphParams, SaveFlowGraphParams } from './use-cases/FlowGraph.use-cases'

export { QuickReplyRepository } from './repositories/QuickReplyRepository'
export type {
  ListQuickRepliesParams as ListQuickReplyRowsParams,
  CreateQuickReplyParams as CreateQuickReplyRowParams,
  UpdateQuickReplyParams as UpdateQuickReplyRowParams,
} from './repositories/QuickReplyRepository'
export {
  ListQuickRepliesUseCase,
  CreateQuickReplyUseCase,
  UpdateQuickReplyUseCase,
  DeleteQuickReplyUseCase,
  toQuickReplyView,
} from './use-cases/QuickReply.use-cases'
export type {
  ListQuickRepliesParams,
  SaveQuickReplyParams,
  UpdateQuickReplyParams,
  DeleteQuickReplyParams,
} from './use-cases/QuickReply.use-cases'
export { createMetaWhatsAppQuickReplyRoutes } from './http/quickReplyRoutes'
export type { CreateMetaWhatsAppQuickReplyRoutesParams } from './http/quickReplyRoutes'
export { QUICK_REPLY_SCOPE, DEFAULT_QUICK_REPLY_WRITE_SCOPES } from './http/quickReplyScope.constant'
export type { QuickReplyRouteScopes } from './http/quickReplyScope.constant'
