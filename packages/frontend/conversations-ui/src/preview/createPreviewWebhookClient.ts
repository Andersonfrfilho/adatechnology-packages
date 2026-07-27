/**
 * Cliente que entrega mensagens do preview no webhook real, assinadas com HMAC — a mesma validação
 * de staging e produção, sem rota alternativa e sem bypass. Do ponto de vista da API, este cliente
 * é indistinguível da Meta; o que muda é apenas quem assina.
 *
 * Assina com WebCrypto porque `node:crypto` não existe no navegador. Os builders vêm dos contratos
 * (isomórficos) justamente para que o mesmo payload seja montado nos dois runtimes.
 *
 * ⚠️ Isto carrega o app secret de DESENVOLVIMENTO no bundle. Só existe para o docker local, e
 * `assertPreviewEnvironment` recusa rodar em produção — um segredo de dev vazado é irrelevante,
 * mas o hábito de embarcar segredo em frontend não é.
 */

import {
  buildInboundAudioPayload,
  buildInboundInteractivePayload,
  buildInboundTextPayload,
  serializeWebhookPayload,
  type InteractiveReplyOption,
} from '@adatechnology/meta-whatsapp-contracts/testing'

export type PreviewWebhookClient = {
  sendText(text: string): Promise<void>
  sendButtonReply(reply: InteractiveReplyOption): Promise<void>
  sendListReply(reply: InteractiveReplyOption): Promise<void>
  sendAudio(mediaId: string): Promise<void>
}

export type CreatePreviewWebhookClientParams = {
  readonly webhookUrl: string
  readonly appSecret: string
  readonly from: string
  readonly phoneNumberId?: string
  // Escape hatch para teste; em runtime real é sempre o fetch global.
  readonly fetchImplementation?: typeof fetch
}

export class PreviewInProductionError extends Error {
  constructor() {
    super('O preview de conversa carrega um app secret e não pode ser montado em produção.')
    this.name = 'PreviewInProductionError'
  }
}

export class PreviewWebhookRejectedError extends Error {
  constructor(readonly status: number) {
    super(`O webhook recusou a entrega do preview (HTTP ${status}).`)
    this.name = 'PreviewWebhookRejectedError'
  }
}

/**
 * Falha alto em vez de degradar em silêncio: um preview que "quase funciona" em produção é pior
 * que um que se recusa a montar.
 */
export function assertPreviewEnvironment(isProduction: boolean): void {
  if (isProduction) throw new PreviewInProductionError()
}

async function signWithWebCrypto(params: { rawBody: string; appSecret: string }): Promise<string> {
  const encoder = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(params.appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(params.rawBody))

  return `sha256=${[...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function createPreviewWebhookClient(params: CreatePreviewWebhookClientParams): PreviewWebhookClient {
  const sendPayload = async (payload: ReturnType<typeof buildInboundTextPayload>): Promise<void> => {
    // Serializa uma vez só: assinar um texto e enviar outro (mesmo com o conteúdo igual) derruba a
    // validação, porque o HMAC cobre os bytes exatos.
    const rawBody = serializeWebhookPayload(payload)
    const signature = await signWithWebCrypto({ rawBody, appSecret: params.appSecret })
    const performRequest = params.fetchImplementation ?? fetch

    const response = await performRequest(params.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
      body: rawBody,
    })

    if (!response.ok) throw new PreviewWebhookRejectedError(response.status)
  }

  const envelope = { from: params.from, phoneNumberId: params.phoneNumberId }

  return {
    sendText: (text) => sendPayload(buildInboundTextPayload({ ...envelope, text })),
    sendButtonReply: (reply) => sendPayload(buildInboundInteractivePayload({ ...envelope, buttonReply: reply })),
    sendListReply: (reply) => sendPayload(buildInboundInteractivePayload({ ...envelope, listReply: reply })),
    sendAudio: (mediaId) => sendPayload(buildInboundAudioPayload({ ...envelope, mediaId })),
  }
}
