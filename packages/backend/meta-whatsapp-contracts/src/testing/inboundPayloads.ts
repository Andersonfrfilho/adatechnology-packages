/**
 * Builders de payload inbound para exercitar o webhook em desenvolvimento sem um app da Meta
 * credenciado. Moram aqui, e não no módulo, por uma razão de runtime: o preview do navegador
 * precisa montar payloads, e o módulo depende de `node:crypto` — importá-lo do frontend quebraria
 * o bundle. Este pacote só depende de zod, então roda nos dois lados.
 *
 * São construção de payload, não assinatura: assinar depende do runtime (`node:crypto` no
 * servidor, WebCrypto no navegador) e fica com quem tem o segredo.
 *
 * Por que `id` e `timestamp` são novos a cada chamada: o anti-replay do webhook usa o header de
 * assinatura como nonce, e a assinatura é derivada do corpo cru. Dois payloads idênticos geram a
 * mesma assinatura, e a segunda entrega é descartada como duplicata — numa conversa real ("sim"
 * duas vezes) isso apareceria como mensagem engolida, sem erro nenhum para investigar.
 */

import type { WhatsAppMessage, WhatsAppWebhookPayload } from '../webhook.types'

// Valores de dev que espelham o formato dos reais (15 dígitos) sem apontar para nada da Meta.
export const PREVIEW_PHONE_NUMBER_ID = '000000000000000'
export const PREVIEW_WABA_ID = '000000000000001'
export const PREVIEW_DISPLAY_PHONE_NUMBER = '+5511900000000'

// O que a Meta manda para áudio gravado no app; o pipeline de STT depende do mime para decodificar.
export const PREVIEW_AUDIO_MIME_TYPE = 'audio/ogg; codecs=opus'

type InboundEnvelopeParams = {
  readonly from: string
  readonly phoneNumberId?: string
  readonly displayPhoneNumber?: string
  readonly wabaId?: string
}

// `globalThis.crypto` em vez de `node:crypto`: é o que existe tanto no navegador quanto no Node
// 19+/Bun, e é o que mantém estes builders utilizáveis pelo preview do navegador.
function generateWamid(): string {
  // Formato real é `wamid.<base64>`. O prefixo importa para quem faz parsing por prefixo; o corpo
  // só precisa ser único por entrega, que é o que mantém a assinatura — e o nonce — distinta.
  const unique = globalThis.crypto.randomUUID().replaceAll('-', '')
  return `wamid.${unique}`
}

function currentTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

type BuildEnvelopeParams = InboundEnvelopeParams & {
  readonly message: WhatsAppMessage
}

function buildEnvelope(params: BuildEnvelopeParams): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: params.wabaId ?? PREVIEW_WABA_ID,
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: params.displayPhoneNumber ?? PREVIEW_DISPLAY_PHONE_NUMBER,
                phone_number_id: params.phoneNumberId ?? PREVIEW_PHONE_NUMBER_ID,
              },
              messages: [params.message],
            },
          },
        ],
      },
    ],
  }
}

export type BuildInboundTextPayloadParams = InboundEnvelopeParams & {
  readonly text: string
}

export function buildInboundTextPayload(params: BuildInboundTextPayloadParams): WhatsAppWebhookPayload {
  const { text, ...envelope } = params

  return buildEnvelope({
    ...envelope,
    message: {
      id: generateWamid(),
      from: params.from,
      type: 'text',
      text: { body: text },
      timestamp: currentTimestamp(),
    },
  })
}

export type InteractiveReplyOption = {
  readonly id: string
  readonly title: string
}

// União exclusiva: uma resposta interativa é de botão OU de lista, nunca das duas nem de nenhuma.
// O tipo torna o erro impossível em vez de validá-lo em runtime.
export type BuildInboundInteractivePayloadParams = InboundEnvelopeParams &
  (
    | { readonly buttonReply: InteractiveReplyOption; readonly listReply?: never }
    | { readonly listReply: InteractiveReplyOption; readonly buttonReply?: never }
  )

export function buildInboundInteractivePayload(params: BuildInboundInteractivePayloadParams): WhatsAppWebhookPayload {
  const { buttonReply, listReply, ...envelope } = params

  const interactive = buttonReply
    ? { type: 'button_reply', button_reply: buttonReply }
    : { type: 'list_reply', list_reply: listReply }

  return buildEnvelope({
    ...envelope,
    message: {
      id: generateWamid(),
      from: params.from,
      type: 'interactive',
      interactive,
      timestamp: currentTimestamp(),
    },
  })
}

export type BuildInboundAudioPayloadParams = InboundEnvelopeParams & {
  readonly mediaId: string
  readonly mimeType?: string
}

export function buildInboundAudioPayload(params: BuildInboundAudioPayloadParams): WhatsAppWebhookPayload {
  const { mediaId, mimeType, ...envelope } = params

  return buildEnvelope({
    ...envelope,
    message: {
      id: generateWamid(),
      from: params.from,
      type: 'audio',
      audio: { id: mediaId, mime_type: mimeType ?? PREVIEW_AUDIO_MIME_TYPE },
      timestamp: currentTimestamp(),
    },
  })
}

/**
 * Serializa o payload uma única vez. A validação assina os bytes exatos recebidos: quem reserializa
 * antes de enviar (ou deixa o cliente HTTP serializar o objeto) muda espaçamento/ordem e derruba a
 * assinatura. Assinar e enviar SEMPRE a string devolvida aqui é o contrato.
 */
export function serializeWebhookPayload(payload: WhatsAppWebhookPayload): string {
  return JSON.stringify(payload)
}
