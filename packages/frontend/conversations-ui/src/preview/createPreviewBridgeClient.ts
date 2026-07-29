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
import type { PreviewWebhookClient, SendPreviewMediaParams } from './createPreviewWebhookClient'

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

export function createPreviewBridgeClient(params: CreatePreviewBridgeClientParams): PreviewWebhookClient {
  const send = params.sendCommand ?? buildFetchSender(params)
  const from = params.from

  return {
    sendText: (text) => send({ kind: 'text', from, text }),
    sendButtonReply: (reply) => send({ kind: 'buttonReply', from, reply }),
    sendListReply: (reply) => send({ kind: 'listReply', from, reply }),
    sendAudio: (mediaId) => send({ kind: 'audio', from, mediaId }),
    sendMedia: (media) => send({ kind: 'media', from, ...media }),
  }
}

export type { InboundMediaType }
