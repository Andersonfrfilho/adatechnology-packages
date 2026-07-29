/**
 * Export separado (`@adatechnology/meta-whatsapp-contracts/testing`): utilitário de
 * desenvolvimento não entra no grafo de import de quem consome os contratos em produção.
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
} from './inboundPayloads'

export type {
  BuildInboundTextPayloadParams,
  BuildInboundInteractivePayloadParams,
  BuildInboundAudioPayloadParams,
  BuildInboundMediaPayloadParams,
  InboundMediaType,
  InteractiveReplyOption,
} from './inboundPayloads'
