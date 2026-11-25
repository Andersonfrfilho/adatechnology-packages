/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Dublês para os testes do runner: sessão em memória, envios gravados, grafos por chave.
 * Não é exportado pelo pacote.
 */

import type {
  ChannelAdapterInterface,
  FlowGraphData,
  FlowNodeData,
  InteractiveMessage,
  WhatsAppMessage,
} from '@adatechnology/meta-whatsapp-contracts'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SessionRow } from '../schema/schema'
import type { SendMessageUseCase } from '../use-cases/SendMessage.use-case'
import type { RequestHumanConversationUseCase } from '../use-cases/RequestHumanConversation.use-case'
import { FlowInterpreter } from './FlowInterpreter'
import { FlowHandoff } from './FlowHandoff'
import { FlowRunner } from './FlowRunner'
import type { FlowRunnerConfig } from './flowRunner.types'
import { FLOW_ACTION_KIND } from '@adatechnology/meta-whatsapp-contracts'

export const COMPANY_ID = 'company-1'
export const CUSTOMER = '5511999990000'

export type SentMessage =
  | { readonly kind: 'text'; readonly body: string }
  | { readonly kind: 'interactive'; readonly interactive: InteractiveMessage }

export function graph(key: string, startNodeId: string, nodes: FlowNodeData[]): FlowGraphData {
  return { key, label: key, startNodeId, version: 1, nodes: Object.fromEntries(nodes.map((node) => [node.id, node])) }
}

export function textMessage(body: string): WhatsAppMessage {
  return {
    from: CUSTOMER,
    id: `wamid.${Math.random()}`,
    timestamp: '1',
    type: 'text',
    text: { body },
  } as WhatsAppMessage
}

export function replyMessage(id: string, kind: 'button' | 'list' = 'button'): WhatsAppMessage {
  const interactive =
    kind === 'button'
      ? { type: 'button_reply', button_reply: { id, title: id } }
      : { type: 'list_reply', list_reply: { id, title: id } }
  return {
    from: CUSTOMER,
    id: `wamid.${Math.random()}`,
    timestamp: '1',
    type: 'interactive',
    interactive,
  } as WhatsAppMessage
}

function sessionRow(): SessionRow {
  const now = new Date('2026-11-25T12:00:00Z')
  return {
    id: 'session-1',
    companyId: COMPANY_ID,
    whatsappNumber: CUSTOMER,
    currentState: 'start',
    flowKey: null,
    currentNodeId: null,
    context: {},
    mode: 'bot',
    assignedUserId: null,
    humanRequestedAt: null,
    lastInboundAt: now,
    lastAgentReadAt: null,
    lastActivity: now,
    createdAt: now,
    updatedAt: now,
  } as SessionRow
}

export function buildRunner(params: { readonly graphs: FlowGraphData[]; readonly config?: FlowRunnerConfig }) {
  const row = sessionRow()
  const sent: SentMessage[] = []
  const humanRequests: string[] = []
  const errors: unknown[] = []

  const sessionRepository = {
    getContext: async () => row,
    saveFlowProgress: async (
      _companyId: string,
      _number: string,
      progress: { flowKey: string | null; currentNodeId: string | null; context: Record<string, unknown> },
    ) => {
      row.flowKey = progress.flowKey
      row.currentNodeId = progress.currentNodeId
      row.context = progress.context
    },
  } as unknown as SessionRepository

  const sendMessage = {
    sendText: async (input: { body: string }) => void sent.push({ kind: 'text', body: input.body }),
    sendInteractive: async (input: { interactive: InteractiveMessage }) =>
      void sent.push({ kind: 'interactive', interactive: input.interactive }),
  } as unknown as SendMessageUseCase

  const requestHuman = {
    execute: async (input: { whatsappNumber: string }) => {
      humanRequests.push(input.whatsappNumber)
      row.humanRequestedAt = new Date()
    },
  } as unknown as RequestHumanConversationUseCase

  const config: FlowRunnerConfig = {
    now: () => new Date('2026-11-25T18:00:00Z'),
    timeZone: 'America/Sao_Paulo',
    ...params.config,
  }
  const interpreter = new FlowInterpreter()
  const handoff = new FlowHandoff({
    requestHuman,
    sendMessage,
    startState: 'start',
    config: config.handoff ?? {},
    now: config.now ?? (() => new Date()),
    interpolation: {},
  })
  const graphs = new Map(params.graphs.map((entry) => [entry.key, entry]))
  const runner = new FlowRunner({
    interpreter,
    flowGraphRepository: { get: async (_companyId: string, key: string) => graphs.get(key) },
    sessionRepository,
    sendMessage,
    channel: {} as ChannelAdapterInterface,
    handoff,
    startState: 'start',
    config,
    hooks: { onFlowRunnerError: (error) => void errors.push(error) },
  })
  interpreter.registerFlowAction(
    FLOW_ACTION_KIND.HANDOFF,
    handoff.createActionHandler((turn) => runner.variablesFor(turn)),
  )

  const takeSent = (): SentMessage[] => sent.splice(0, sent.length)
  const handle = (message: WhatsAppMessage, profileName?: string) =>
    runner.handle({ companyId: COMPANY_ID, message, ...(profileName ? { profileName } : {}) })

  return { runner, interpreter, row, takeSent, humanRequests, errors, handle }
}
