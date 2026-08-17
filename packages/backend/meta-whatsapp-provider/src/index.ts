export { WhatsAppMessageProvider } from './WhatsAppMessageProvider'
export { WhatsAppTemplateProvider } from './WhatsAppTemplateProvider'
export { createWhatsAppProvider } from './WhatsAppProviderFactory'
export { normalizeOutboundAudio, createFfmpegTranscoder, OPUS_MIME_TYPE } from './normalizeOutboundAudio'
export type { AudioTranscoder, NormalizeOutboundAudioParams, NormalizedOutboundAudio } from './normalizeOutboundAudio'
export { detectAudioContainer, isAcceptedByWhatsApp, AUDIO_CONTAINER } from './audioContainer'
export type { AudioContainer } from './audioContainer'
export type { WhatsAppProvider } from './WhatsAppProviderFactory'

// Re-exporta os erros que os métodos deste pacote lançam. Eles moram em meta-graph-core (são
// comuns a qualquer API da Meta), mas exigir que o consumidor instale e importe um segundo
// pacote só para escrever um `catch` seria vazar detalhe de organização interna na API pública.
export {
  MetaGraphError,
  WhatsAppAudioTranscodeError,
  WhatsAppConfigError,
  WhatsAppConnectionError,
  WhatsAppRejectionError,
  WhatsAppTimeoutError,
  WhatsAppWindowExpiredError,
  WhatsAppTemplateDuplicateError,
  WhatsAppUnexpectedResponseError,
} from '@adatechnology/meta-graph-core'
export type {
  WhatsAppProviderConfig,
  SendMessageResult,
  SendMediaParams,
  SendTemplateParams,
  FetchMediaResult,
  InteractiveButton,
  SendInteractiveButtonsParams,
  InteractiveListRow,
  InteractiveListSection,
  SendInteractiveListParams,
  SendCatalogMessageParams,
  SendProductMessageParams,
  ProductListSection,
  SendProductListMessageParams,
  CreateTemplateParams,
  CreateTemplateResult,
  WhatsAppTemplateSummary,
  TemplateComponent,
  WhatsAppTemplateDetail,
  DeleteTemplateParams,
} from './types'
