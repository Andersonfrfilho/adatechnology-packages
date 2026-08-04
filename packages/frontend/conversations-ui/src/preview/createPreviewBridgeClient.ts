/**
 * Cliente do preview que NÃO carrega segredo: em vez de montar e assinar o payload da Meta no
 * navegador, manda um comando semântico (`{ kind: 'text', text }`) para uma rota do próprio host,
 * autenticada pela sessão que o painel já tem. Quem monta o payload e assina é o servidor, com o
 * app secret que nunca sai de lá.
 *
 * Por que esta fábrica existe ao lado de `createPreviewWebhookClient`: assinar no navegador exige o
 * app secret dentro do bundle, e bundle é público por definição — em qualquer ambiente com URL
 * acessível isso é o mesmo que publicar o segredo. Com o segredo vazado, qualquer um forja webhooks
 * válidos daquele app: injeta mensagens de qualquer número e dispara os fluxos. `createPreviewWebhook
 * Client` continua servindo para execução puramente local (docker de dev, onde o bundle não é
 * servido para ninguém); para qualquer ambiente publicado, a ponte é o caminho.
 *
 * O pacote não decide autenticação: o host injeta `sendCommand` (ou `headers` + `fetchImplementation`),
 * porque token, cookie e cabeçalho de sessão são do produto, não da biblioteca.
 */

import type { InboundMediaType, InteractiveReplyOption } from '@adatechnology/meta-whatsapp-contracts/testing'
import {
  createPreviewMediaPoster,
  defaultMediaUploadUrl,
  type PreviewWebhookClient,
  type SendPreviewMediaParams,
} from './createPreviewWebhookClient'
import type { PreviewUploadedMedia } from './createPreviewMediaUploader'

/**
 * Comando semântico entregue ao host. É deliberadamente o QUE o cliente fez, não o payload da Meta:
 * se o navegador mandasse o payload pronto, a rota viraria um injetor de webhook arbitrário para
 * quem tivesse sessão. Mandando a intenção, o servidor é quem escolhe a forma.
 */
export type PreviewInboundCommand =
  | { readonly kind: 'text'; readonly from: string; readonly text: string }
  | { readonly kind: 'buttonReply'; readonly from: string; readonly reply: InteractiveReplyOption }
  | { readonly kind: 'listReply'; readonly from: string; readonly reply: InteractiveReplyOption }
  | { readonly kind: 'audio'; readonly from: string; readonly mediaId: string }
  | ({ readonly kind: 'media'; readonly from: string } & SendPreviewMediaParams)

export type SendPreviewInboundCommand = (command: PreviewInboundCommand) => Promise<void>

export class PreviewBridgeRejectedError extends Error {
  constructor(readonly status: number) {
    super(`A rota de preview do host recusou a entrega (HTTP ${status}).`)
    this.name = 'PreviewBridgeRejectedError'
  }
}

export type CreatePreviewBridgeClientParams = {
  readonly from: string
  /**
   * Entrega o comando. Use quando o host já tem um cliente HTTP com sessão, interceptors e refresh
   * de token — reimplementar isso aqui só duplicaria a autenticação do produto.
   */
  readonly sendCommand?: SendPreviewInboundCommand
  /** Alternativa a `sendCommand` para hosts sem cliente HTTP próprio. */
  readonly endpointUrl?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly fetchImplementation?: typeof fetch
  /**
   * Rota que guarda o áudio gravado. Por padrão, `/v1/preview/media` na origem do `endpointUrl`.
   *
   * Aqui não há assinatura a calcular: a ponte existe justamente para não ter segredo no navegador,
   * e a rota é protegida pela sessão do painel — os mesmos `headers` do comando valem para o upload.
   */
  readonly mediaUploadUrl?: string
  /**
   * Substitui o upload embutido. Necessário para host que só passa `sendCommand`: sem `endpointUrl`
   * não há origem a derivar, e sem destino o gravador não é desenhado.
   */
  readonly uploadMedia?: (file: File) => Promise<PreviewUploadedMedia>
}

function buildFetchSender(params: CreatePreviewBridgeClientParams): SendPreviewInboundCommand {
  const endpointUrl = params.endpointUrl
  if (!endpointUrl) {
    throw new Error('createPreviewBridgeClient exige `sendCommand` ou `endpointUrl`.')
  }

  return async (command) => {
    const performRequest = params.fetchImplementation ?? fetch
    const response = await performRequest(endpointUrl, {
      method: 'POST',
      // `credentials` fica com o host via `headers`/`fetchImplementation`: sessão por cookie e por
      // bearer não convivem numa escolha default sem quebrar um dos dois.
      headers: { 'content-type': 'application/json', ...params.headers },
      body: JSON.stringify(command),
    })

    if (!response.ok) throw new PreviewBridgeRejectedError(response.status)
  }
}

/** Só existe quando há para onde mandar: rota explícita, ou origem herdada do `endpointUrl`. */
function resolveBridgeUpload(
  params: CreatePreviewBridgeClientParams,
): ((file: File) => Promise<PreviewUploadedMedia>) | undefined {
  if (params.uploadMedia) return params.uploadMedia

  const url = params.mediaUploadUrl ?? (params.endpointUrl ? defaultMediaUploadUrl(params.endpointUrl) : undefined)
  if (!url) return undefined

  return createPreviewMediaPoster({
    url,
    ...(params.headers ? { headers: async () => params.headers ?? {} } : {}),
    ...(params.fetchImplementation ? { fetchImplementation: params.fetchImplementation } : {}),
  })
}

export function createPreviewBridgeClient(params: CreatePreviewBridgeClientParams): PreviewWebhookClient {
  const send = params.sendCommand ?? buildFetchSender(params)
  const from = params.from
  const uploadMedia = resolveBridgeUpload(params)

  return {
    sendText: (text) => send({ kind: 'text', from, text }),
    sendButtonReply: (reply) => send({ kind: 'buttonReply', from, reply }),
    sendListReply: (reply) => send({ kind: 'listReply', from, reply }),
    sendAudio: (mediaId) => send({ kind: 'audio', from, mediaId }),
    sendMedia: (media) => send({ kind: 'media', from, ...media }),
    ...(uploadMedia ? { uploadMedia } : {}),
  }
}

export type { InboundMediaType }
