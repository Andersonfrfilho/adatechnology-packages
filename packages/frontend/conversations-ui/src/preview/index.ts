/**
 * Export separado (`@adatechnology/conversations-ui/preview`) para que fixtures e mocks nunca
 * entrem no bundle de produção de quem consome o pacote.
 */

export { createPreviewStore, conversationChannel, GLOBAL_CHANNEL } from './previewStore'
export type {
  PreviewStore,
  CreatePreviewStoreParams,
  PreviewEmission,
  PreviewStoreListener,
  AppendMessageParams,
  SetModeParams,
  ListConversationsFilters,
} from './previewStore'

export { createMockEventSource } from './mockEventSource'
export type { MockEventSource } from './mockEventSource'

export { createMockConversationsApi } from './createMockConversationsApi'
export type { CreateMockConversationsApiParams } from './createMockConversationsApi'

export { createMockSSEProvider } from './createMockSSEProvider'
export type { CreateMockSSEProviderParams } from './createMockSSEProvider'

export { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES } from './previewFixtures'

export { ConversationPreview } from './ConversationPreview'
export type { ConversationPreviewProps } from './ConversationPreview'

export {
  createPreviewWebhookClient,
  assertPreviewEnvironment,
  PreviewInProductionError,
  PreviewWebhookRejectedError,
} from './createPreviewWebhookClient'
export type { PreviewWebhookClient, CreatePreviewWebhookClientParams } from './createPreviewWebhookClient'

export { startPreviewScript, DEFAULT_PREVIEW_SCRIPT } from './startPreviewScript'
export type { PreviewScriptStep, StartPreviewScriptParams } from './startPreviewScript'
