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
import { InProcessFlowTurnLock } from './flowTurnLock'
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

export function textMessage(body: string, id = `wamid.${Math.random()}`): WhatsAppMessage {
  return {
    from: CUSTOMER,
    id,
    timestamp: '1',
    type: 'text',
    text: { body },
  } as WhatsAppMessage
}

export function mediaMessage(type: 'audio' | 'image'): WhatsAppMessage {
  return {
    from: CUSTOMER,
    id: `wamid.${Math.random()}`,
    timestamp: '1',
    type,
    [type]: { id: 'media-1' },
  } as WhatsAppMessage
}

export function templateButtonMessage(text: string): WhatsAppMessage {
  return {
    from: CUSTOMER,
    id: `wamid.${Math.random()}`,
    timestamp: '1',
    type: 'button',
    button: { text },
  } as WhatsAppMessage
}

const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

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

export type BuildRunnerParams = {
  readonly graphs: FlowGraphData[]
  readonly config?: FlowRunnerConfig
  /** Sem `onFlowRunnerError` configurado. */
  readonly withoutErrorHook?: boolean
  /** Sem lock por conversa — para provar que o lock é o que serializa. */
  readonly withoutLock?: boolean
}

export function buildRunner(params: BuildRunnerParams) {
  const row = sessionRow()
  const sent: SentMessage[] = []
  const humanRequests: string[] = []
  const errors: unknown[] = []
  // Quantas das próximas chamadas falham, por dublê.
  const failures = { send: 0, requestHuman: 0 }

  const failIfScheduled = (kind: keyof typeof failures): void => {
    if (failures[kind] <= 0) return
    failures[kind] -= 1
    throw new Error(`${kind} failed`)
  }

  const sessionRepository = {
    // Cópia a cada leitura, como o banco: duas leituras não compartilham objeto.
    // A leitura vale do instante da chamada; a resposta chega depois — é o que deixa duas mensagens
    // concorrentes enxergarem a mesma posição quando nada as serializa.
    getContext: async () => {
      const snapshot = { ...row, context: structuredClone(row.context) }
      await nextTick()
      return snapshot
    },
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
    sendText: async (input: { body: string }) => {
      await nextTick()
      failIfScheduled('send')
      sent.push({ kind: 'text', body: input.body })
    },
    sendInteractive: async (input: { interactive: InteractiveMessage }) => {
      await nextTick()
      failIfScheduled('send')
      sent.push({ kind: 'interactive', interactive: input.interactive })
    },
  } as unknown as SendMessageUseCase

  const requestHuman = {
    execute: async (input: { whatsappNumber: string }) => {
      failIfScheduled('requestHuman')
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
    ...(params.withoutErrorHook ? {} : { hooks: { onFlowRunnerError: (error: unknown) => void errors.push(error) } }),
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
    lock: params.withoutLock ? { withLock: (_key, work) => work() } : new InProcessFlowTurnLock(),
    ...(params.withoutErrorHook ? {} : { hooks: { onFlowRunnerError: (error: unknown) => void errors.push(error) } }),
  })
  interpreter.registerFlowAction(
    FLOW_ACTION_KIND.HANDOFF,
    handoff.createActionHandler((turn) => runner.variablesFor(turn)),
  )

  const takeSent = (): SentMessage[] => sent.splice(0, sent.length)
  const handle = (message: WhatsAppMessage, profileName?: string) =>
    runner.handle({ companyId: COMPANY_ID, message, ...(profileName ? { profileName } : {}) })

  return { runner, interpreter, row, takeSent, humanRequests, errors, failures, handle }
}
