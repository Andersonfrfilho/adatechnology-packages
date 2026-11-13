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
import { createPreviewMediaUploader, type PreviewUploadedMedia } from './createPreviewMediaUploader'

export type PreviewWebhookClient = {
  sendText(text: string): Promise<void>
  sendButtonReply(reply: InteractiveReplyOption): Promise<void>
  sendListReply(reply: InteractiveReplyOption): Promise<void>
  sendAudio(mediaId: string): Promise<void>
  sendMedia(params: SendPreviewMediaParams): Promise<void>
  /**
   * Guarda um arquivo gravado e devolve o `mediaId` já prefixado, pronto para `sendMedia`.
   *
   * Existe no cliente, e não como prop de quem monta a tela, porque isto é exatamente o que ele já
   * sabe fazer: falar com ESTE host usando ESTE segredo. Enquanto era responsabilidade do produto,
   * o resultado prático foi um produto com microfone no simulador e outro sem — não por decisão,
   * por esquecimento. Cliente montado, microfone na tela.
   *
   * Opcional porque o cliente-ponte só consegue oferecer isto quando sabe a rota de mídia (ou quando
   * o host injeta a função): sem destino, gravar áudio seria falar para o vazio, e aí a tela
   * corretamente não desenha o gravador.
   */
  uploadMedia?(file: File): Promise<PreviewUploadedMedia>
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
  /**
   * Rota que guarda o áudio gravado. Por padrão, `/v1/preview/media` na mesma origem do webhook.
   *
   * O padrão cobre o caso normal — as duas rotas são do mesmo servidor — e a prop existe para quem
   * publica a API em outro host ou versiona o caminho.
   */
  readonly mediaUploadUrl?: string
  // Escape hatch para teste; em runtime real é sempre o fetch global.
  readonly fetchImplementation?: typeof fetch
}

/** Falha da rota de upload, separada da do webhook: os dois lados quebram por motivos diferentes. */
export class PreviewMediaUploadRejectedError extends Error {
  constructor(readonly status: number) {
    super(`A rota de mídia do simulador recusou o upload (HTTP ${status}).`)
    this.name = 'PreviewMediaUploadRejectedError'
  }
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

export const DEFAULT_MEDIA_UPLOAD_PATH = '/v1/preview/media'

/**
 * Mesma origem do webhook: as duas rotas são do mesmo servidor no caso normal.
 *
 * Quando `webhookUrl` é relativa — que é o que sai de um `VITE_API_URL` vazio, com o front servido
 * pela própria API — não há origem para resolver contra, e o caminho relativo já aponta para o
 * lugar certo. `new URL` com base relativa lançaria, e o microfone morreria no `createClient`.
 */
export function defaultMediaUploadUrl(webhookUrl: string): string {
  try {
    return new URL(DEFAULT_MEDIA_UPLOAD_PATH, webhookUrl).toString()
  } catch {
    return DEFAULT_MEDIA_UPLOAD_PATH
  }
}

/**
 * O POST de mídia, sem a parte de assinatura — para os dois clientes usarem o mesmo caminho.
 *
 * O cliente-ponte autentica por sessão e o de webhook por HMAC; o que não muda é a rota, o formato
 * do corpo e a leitura do `uploadId`. Duas cópias disso é como o prefixo de mídia divergiu antes.
 */
export function createPreviewMediaPoster(params: {
  readonly url: string
  readonly headers?: (mimeType: string) => Promise<Readonly<Record<string, string>>>
  readonly fetchImplementation?: typeof fetch
}): (file: File) => Promise<PreviewUploadedMedia> {
  return createPreviewMediaUploader({
    upload: async (request) => {
      const performRequest = params.fetchImplementation ?? fetch
      const extraHeaders = (await params.headers?.(request.mimeType)) ?? {}

      const response = await performRequest(params.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...extraHeaders },
        body: JSON.stringify(request),
      })

      if (!response.ok) throw new PreviewMediaUploadRejectedError(response.status)

      const body = (await response.json()) as { data: { uploadId: string } }
      return { uploadId: body.data.uploadId }
    },
  })
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

  /**
   * Assina o MIME, não o binário — mesmo contrato da rota.
   *
   * Passar megabytes de base64 pelo HMAC do navegador travaria a aba a cada nota de voz; o que a
   * assinatura protege aqui é o acesso à rota, e o binário já tem teto de tamanho no servidor.
   */
  const uploadMedia = createPreviewMediaPoster({
    url: params.mediaUploadUrl ?? defaultMediaUploadUrl(params.webhookUrl),
    headers: async (mimeType) => ({
      'x-preview-signature': await signWithWebCrypto({ rawBody: mimeType, appSecret: params.appSecret }),
    }),
    ...(params.fetchImplementation ? { fetchImplementation: params.fetchImplementation } : {}),
  })

  const envelope = { from: params.from, phoneNumberId: params.phoneNumberId }

  return {
    sendText: (text) => sendPayload(buildInboundTextPayload({ ...envelope, text })),
    sendButtonReply: (reply) => sendPayload(buildInboundInteractivePayload({ ...envelope, buttonReply: reply })),
    sendListReply: (reply) => sendPayload(buildInboundInteractivePayload({ ...envelope, listReply: reply })),
    sendAudio: (mediaId) => sendPayload(buildInboundAudioPayload({ ...envelope, mediaId })),
    sendMedia: (media) => sendPayload(buildInboundMediaPayload({ ...envelope, ...media })),
    uploadMedia,
  }
}
