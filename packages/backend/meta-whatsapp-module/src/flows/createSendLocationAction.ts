import {
  interpolateFlowText,
  type ConversationSession,
  type FlowActionHandler,
  type SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowMediaTranscriptLogger } from './createSendMediaAction'

export type CreateSendLocationActionParams = {
  logMessage: FlowMediaTranscriptLogger
  startState: SessionState
  variablesFor: (turn: { session: ConversationSession; context: Record<string, unknown> }) => Record<string, unknown>
  onError?: (error: unknown, details: { flowKey: string | null; nodeId: string }) => void
}

function readCoordinate(value: string, limit: number): number | undefined {
  if (value.length === 0) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : undefined
}

/**
 * Action `send_location`: o pino nativo do WhatsApp (abre no mapa do aparelho).
 *
 * `actionParams`: `latitude`, `longitude`, `name`, `address`, todos aceitam `{{chave}}`. Sem coordenada
 * válida (variável vazia) ou num canal sem `sendLocation`, não envia nada e o fluxo segue.
 */
export function createSendLocationAction(params: CreateSendLocationActionParams): FlowActionHandler {
  return async ({ node, session, channel, context }) => {
    if (!channel.sendLocation) return
    const variables = params.variablesFor({ session, context })
    const fill = (key: string): string => interpolateFlowText(String(node.actionParams?.[key] ?? ''), variables).trim()
    const latitude = readCoordinate(fill('latitude'), 90)
    const longitude = readCoordinate(fill('longitude'), 180)
    if (latitude === undefined || longitude === undefined) return
    const name = fill('name')
    const address = fill('address')

    try {
      const { externalMessageId } = await channel.sendLocation({
        to: session.whatsappNumber,
        latitude,
        longitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      })
      await params.logMessage.execute({
        companyId: session.companyId,
        whatsappNumber: session.whatsappNumber,
        direction: 'outbound',
        sender: 'bot',
        agentUserId: null,
        type: 'location',
        content: [name, address].filter(Boolean).join(' · '),
        payload: { location: { latitude, longitude, ...(name ? { name } : {}), ...(address ? { address } : {}) } },
        waMessageId: externalMessageId,
        status: 'sent',
        startState: params.startState,
      })
    } catch (error) {
      params.onError?.(error, { flowKey: session.flowKey, nodeId: node.id })
    }
  }
}
