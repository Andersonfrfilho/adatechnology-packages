/**
 * Export separado (`@adatechnology/meta-whatsapp-module/testing`) para que utilitário de
 * desenvolvimento não entre no grafo de import de quem só consome o módulo em produção.
 *
 * Os builders são reexportados dos contratos por conveniência de quem já depende do módulo
 * (scripts de CLI, `make test-msg`): quem monta payload no navegador deve importar direto de
 * `@adatechnology/meta-whatsapp-contracts/testing`, que não toca em `node:crypto`.
 */

export {
  buildInboundTextPayload,
  buildInboundInteractivePayload,
  buildInboundAudioPayload,
  buildInboundMediaPayload,
  serializeWebhookPayload,
  PREVIEW_PHONE_NUMBER_ID,
  PREVIEW_WABA_ID,
  PREVIEW_DISPLAY_PHONE_NUMBER,
  PREVIEW_AUDIO_MIME_TYPE,
} from '@adatechnology/meta-whatsapp-contracts/testing'

export type {
  BuildInboundTextPayloadParams,
  BuildInboundInteractivePayloadParams,
  BuildInboundAudioPayloadParams,
  BuildInboundMediaPayloadParams,
  InboundMediaType,
  InteractiveReplyOption,
} from '@adatechnology/meta-whatsapp-contracts/testing'

export { MEDIA_SAMPLES, findMediaSample, readMediaSample } from './mediaSamples'
export type { MediaSample, MediaSampleName } from './mediaSamples'

export { signWebhookPayload, toSignedWebhookRequest } from './inboundPayloads'
export type { SignWebhookPayloadParams, SignedWebhookRequest, ToSignedWebhookRequestParams } from './inboundPayloads'
