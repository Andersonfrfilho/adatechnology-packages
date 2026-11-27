import {
  interpolateFlowText,
  type ChannelAdapterInterface,
  type ConversationSession,
  type FlowActionHandler,
  type SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowMediaTranscriptLogger } from './createSendMediaAction'

/** A Meta aceita até 20 caracteres no botão do `cta_url`. */
export const CTA_URL_DISPLAY_TEXT_LIMIT = 20

export type CreateSendCtaUrlActionParams = {
  logMessage: FlowMediaTranscriptLogger
  startState: SessionState
  /** Variáveis do turno (`{{chave}}` do host e do contexto), as mesmas que o texto do fluxo enxerga. */
  variablesFor: (turn: { session: ConversationSession; context: Record<string, unknown> }) => Record<string, unknown>
  onError?: (error: unknown, details: { flowKey: string | null; nodeId: string }) => void
}

function truncate(text: string, limit: number): string {
  const characters = Array.from(text.trim())
  return characters.length <= limit ? characters.join('') : `${characters.slice(0, limit - 1).join('')}…`
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url)
}

/**
 * Action `send_cta_url`: texto com um botão que abre o link, em vez do endereço cru no meio do texto.
 *
 * `actionParams`: `body`, `displayText` e `url`, os três aceitam `{{chave}}`. Sem link http(s) depois de
 * preencher (variável vazia), não envia nada e o fluxo segue — é como um nó pode ser condicional sem
 * ramificar o grafo. Canal sem `sendCtaUrl` recebe o texto com o link embaixo.
 */
export function createSendCtaUrlAction(params: CreateSendCtaUrlActionParams): FlowActionHandler {
  return async ({ node, session, channel, context }) => {
    const variables = params.variablesFor({ session, context })
    const fill = (key: string): string => interpolateFlowText(String(node.actionParams?.[key] ?? ''), variables).trim()
    const body = fill('body')
    const url = fill('url')
    const displayText = truncate(fill('displayText'), CTA_URL_DISPLAY_TEXT_LIMIT)
    if (!isHttpUrl(url) || body.length === 0 || displayText.length === 0) return

    try {
      const { externalMessageId } = await send({ channel, to: session.whatsappNumber, body, displayText, url })
      await params.logMessage.execute({
        companyId: session.companyId,
        whatsappNumber: session.whatsappNumber,
        direction: 'outbound',
        sender: 'bot',
        agentUserId: null,
        type: channel.sendCtaUrl ? 'interactive' : 'text',
        content: channel.sendCtaUrl ? body : `${body}\n${url}`,
        ...(channel.sendCtaUrl ? { payload: { interactive: { kind: 'cta_url', body, displayText, url } } } : {}),
        waMessageId: externalMessageId,
        status: 'sent',
        startState: params.startState,
      })
    } catch (error) {
      // Um botão de link que falha não pode prender a conversa num nó automático.
      params.onError?.(error, { flowKey: session.flowKey, nodeId: node.id })
    }
  }
}

function send(input: {
  channel: ChannelAdapterInterface
  to: string
  body: string
  displayText: string
  url: string
}): Promise<{ externalMessageId: string | null }> {
  const { channel, to, body, displayText, url } = input
  if (channel.sendCtaUrl) return channel.sendCtaUrl({ to, body, displayText, url })
  return channel.sendText(to, `${body}\n${url}`)
}
