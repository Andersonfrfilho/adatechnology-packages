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

export { PREVIEW_CONVERSATIONS, PREVIEW_MESSAGES, PREVIEW_DOCUMENTS } from './previewFixtures'

export { ConversationPreview } from './ConversationPreview'
export { mediaTypeOf } from './ConversationPreview'
export type { ConversationPreviewProps, PreviewUploadedMedia } from './ConversationPreview'

export { AudioRecorderButton, DEFAULT_AUDIO_RECORDER_BUTTON_LABELS } from '../AudioRecorderButton'
export type { AudioRecorderButtonProps, AudioRecorderButtonLabels } from '../AudioRecorderButton'

export {
  createPreviewWebhookClient,
  signPreviewPayload,
  assertPreviewEnvironment,
  PreviewInProductionError,
  PreviewWebhookRejectedError,
} from './createPreviewWebhookClient'
export type {
  PreviewWebhookClient,
  CreatePreviewWebhookClientParams,
  SendPreviewMediaParams,
} from './createPreviewWebhookClient'

export { createPreviewBridgeClient, PreviewBridgeRejectedError } from './createPreviewBridgeClient'
export type {
  CreatePreviewBridgeClientParams,
  PreviewInboundCommand,
  SendPreviewInboundCommand,
} from './createPreviewBridgeClient'

export { startPreviewScript, DEFAULT_PREVIEW_SCRIPT } from './startPreviewScript'
export type { PreviewScriptStep, StartPreviewScriptParams } from './startPreviewScript'
export { PREVIEW_FILE_SAMPLES, resolvePreviewFileSample } from './previewFileSamples'
export { createPreviewMediaResolver, previewFileUrl } from './previewMediaSource'
export { previewFileBase64 } from './previewMediaSource'
export { MediaTypesPreview, MEDIA_TYPES_CONVERSATION_ID } from './MediaTypesPreview'
export type { MediaTypesPreviewProps } from './MediaTypesPreview'
