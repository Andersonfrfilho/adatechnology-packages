export { metaWhatsAppSchema, sessions, messages, flowGraphs } from './schema/schema'
export type {
  SessionRow,
  NewSessionRow,
  MessageRow,
  NewMessageRow,
  FlowGraphRow,
  NewFlowGraphRow,
} from './schema/schema'

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
export type { FlowStepInput, FlowStepResult } from './flows/FlowInterpreter'

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
