/**
 * Cliente que entrega mensagens do preview no webhook real, assinadas com HMAC — a mesma validação
 * de staging e produção, sem rota alternativa e sem bypass. Do ponto de vista da API, este cliente
 * é indistinguível da Meta; o que muda é apenas quem assina.
 *
 * Assina com WebCrypto porque `node:crypto` não existe no navegador. Os builders vêm dos contratos
 * (isomórficos) justamente para que o mesmo payload seja montado nos dois runtimes.
 *
 * ⚠️ SOMENTE EXECUÇÃO LOCAL. Isto carrega o app secret no bundle, e bundle é público onde quer que
 * seja servido — em qualquer ambiente com URL acessível (homologação inclusive) usar esta fábrica
 * equivale a publicar o segredo, e quem o tiver forja webhooks válidos daquele app da Meta: injeta
 * mensagem de qualquer número e dispara os fluxos. `assertPreviewEnvironment` barra produção, mas
 * homologação passaria, então a barreira não basta.
 *
 * Para qualquer ambiente publicado use `createPreviewBridgeClient`: o navegador manda a intenção e
 * o servidor assina com o segredo que ele já tem.
 */

import {
  buildInboundAudioPayload,
  buildInboundInteractivePayload,
  buildInboundMediaPayload,
  buildInboundTextPayload,
  serializeWebhookPayload,
  type InboundMediaType,
  type InteractiveReplyOption,
} from '@adatechnology/meta-whatsapp-contracts/testing'

export type PreviewWebhookClient = {
  sendText(text: string): Promise<void>
  sendButtonReply(reply: InteractiveReplyOption): Promise<void>
  sendListReply(reply: InteractiveReplyOption): Promise<void>
  sendAudio(mediaId: string): Promise<void>
  sendMedia(params: SendPreviewMediaParams): Promise<void>
}

export type SendPreviewMediaParams = {
  readonly mediaType: InboundMediaType
  /**
   * Id que o host já usa para buscar o arquivo. Não é bytes: o webhook da Meta entrega mídia por
   * referência, e o consumidor baixa depois — mandar base64 aqui simularia um payload que a Meta
   * nunca produz, e o caminho testado deixaria de ser o de produção.
   */
  readonly mediaId: string
  readonly mimeType?: string
  readonly filename?: string
  readonly caption?: string
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

/**
 * Assina um texto qualquer com o app secret, no mesmo formato do header da Meta.
 *
 * Exportada porque o preview precisa provar identidade em MAIS de um lugar: além de entregar a
 * mensagem no webhook, ele lê o transcript de volta — e ler pela API de admin exigia uma sessão que
 * a aba do simulador não tem. Assinar a leitura com o segredo que ele já carrega resolve sem token
 * de admin e sem rota aberta.
 */
export async function signPreviewPayload(params: { rawBody: string; appSecret: string }): Promise<string> {
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

const signWithWebCrypto = signPreviewPayload

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
    sendMedia: (media) => sendPayload(buildInboundMediaPayload({ ...envelope, ...media })),
  }
}
