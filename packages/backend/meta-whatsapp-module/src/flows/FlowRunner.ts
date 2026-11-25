/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Runner de fluxo: o que faltava entre o `FlowInterpreter` (máquina de estados pura) e o cliente.
 * Carrega o grafo publicado, entende a resposta, avança o interpretador, grava posição e contexto e
 * fala com o cliente — pergunta, botões/lista, `directMessage`, nova tentativa e encaminhamento.
 *
 * Antes dele, cada host escrevia o próprio driver (centenas de linhas) e o motor de fluxo do pacote
 * não fazia nada sozinho depois do `onMessageReceived`.
 */

import {
  FLOW_DATE_LOCALE_PT_BR,
  FlowRunnerError,
  isCrossFlowTarget,
  crossFlowKey,
  matchesFlowKeyword,
  type ChannelAdapterInterface,
  type ConversationSession,
  type DynamicChoiceProvider,
  type FlowAnswerRejection,
  type FlowClock,
  type FlowGraphData,
  type FlowNodeData,
  type MetaWhatsAppHooks,
  type SessionState,
  type WhatsAppMessage,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowGraphRepository } from '../repositories/FlowGraphRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SendMessageUseCase } from '../use-cases/SendMessage.use-case'
import { extractAnswer, toSessionContract } from '../channel/inboundDispatch'
import type { FlowInterpreter } from './FlowInterpreter'
import type { FlowHandoff } from './FlowHandoff'
import type { FlowOutboundMessage } from './buildFlowChoiceMessage'
import { resolveFlowAnswer } from './resolveFlowAnswer'
import { FlowQuestionRenderer } from './FlowQuestionRenderer'
import { runtimeOf, withRuntime } from './flowRuntimeState'
import {
  DEFAULT_FLOW_TEXT,
  DEFAULT_MAX_CROSS_FLOW_JUMPS,
  DEFAULT_MAX_INVALID_ANSWERS,
  DEFAULT_START_FLOW_KEY,
} from './flowRunner.constant'
import type { FlowGlobalKeywordTarget, FlowRunnerConfig, FlowRunnerOutcome } from './flowRunner.types'

export type FlowRunnerDependencies = {
  readonly interpreter: FlowInterpreter
  readonly flowGraphRepository: Pick<FlowGraphRepository, 'get'>
  readonly sessionRepository: SessionRepository
  readonly sendMessage: SendMessageUseCase
  readonly channel: ChannelAdapterInterface
  readonly handoff: FlowHandoff
  readonly startState: SessionState
  readonly config: FlowRunnerConfig
  readonly hooks?: Pick<MetaWhatsAppHooks, 'onFlowRunnerError'>
}

/** Uma mensagem sendo atendida: o que não muda entre os passos. */
type FlowTurn = {
  readonly companyId: string
  readonly session: ConversationSession
  readonly baseVariables: Readonly<Record<string, unknown>>
}

type RunFromParams = {
  readonly graph: FlowGraphData
  readonly nodeId: string
  readonly context: Record<string, unknown>
  readonly userAnswer?: string
  readonly answerValue?: unknown
  readonly enterInitialNode: boolean
}

export type HandleFlowMessageParams = {
  readonly companyId: string
  readonly message: WhatsAppMessage
  readonly profileName?: string
}

export type StartFlowParams = {
  readonly companyId: string
  readonly whatsappNumber: string
  /** Ausente, o fluxo de partida. */
  readonly flowKey?: string
  readonly profileName?: string
}

function contactVariables(profileName: string | undefined): Record<string, unknown> {
  if (!profileName) return {}
  return { contactName: profileName, contactFirstName: profileName.trim().split(/\s+/)[0] ?? profileName }
}

export class FlowRunner {
  private readonly renderer: FlowQuestionRenderer
  // Variáveis da mensagem em curso, por sessão: é como a action `handoff` (que só recebe a sessão)
  // enxerga o nome do contato sem que ele precise ir para o contexto gravado.
  private readonly turnVariables = new WeakMap<ConversationSession, Readonly<Record<string, unknown>>>()

  constructor(private readonly dependencies: FlowRunnerDependencies) {
    this.renderer = new FlowQuestionRenderer(dependencies.config)
  }

  registerDynamicChoiceProvider(key: string, provider: DynamicChoiceProvider): void {
    this.renderer.registerDynamicChoiceProvider(key, provider)
  }

  /** Variáveis para `{{chave}}`: contato, host e contexto, nessa ordem de precedência crescente. */
  variablesFor(params: { session: ConversationSession; context: Record<string, unknown> }): Record<string, unknown> {
    return { ...(this.turnVariables.get(params.session) ?? {}), ...params.context }
  }

  async handle(params: HandleFlowMessageParams): Promise<FlowRunnerOutcome> {
    const row = await this.dependencies.sessionRepository.getContext(params.companyId, params.message.from)
    if (!row) return 'no-session'
    if (row.mode === 'human') return 'human-mode'
    const turn = await this.openTurn(params.companyId, toSessionContract(row), params.profileName)

    const answer = extractAnswer(params.message)
    const isInteractiveReply = params.message.type === 'interactive'
    const globalTarget = !isInteractiveReply && answer !== undefined ? this.globalKeywordTarget(answer) : undefined
    if (globalTarget) return this.applyGlobalTarget(turn, globalTarget)

    const whileAwaitingHuman = this.dependencies.config.whileAwaitingHuman ?? 'silent'
    if (turn.session.humanRequestedAt && !turn.session.currentNodeId && whileAwaitingHuman === 'silent') {
      return 'awaiting-human'
    }

    const graph = await this.loadGraph(params.companyId, turn.session.flowKey ?? this.startFlowKey())
    if (!graph) return 'no-flow'
    const node = turn.session.currentNodeId ? graph.nodes[turn.session.currentNodeId] : undefined
    const context = { ...turn.session.context }

    if (!node) {
      const start = graph.nodes[graph.startNodeId]
      const target =
        start && answer !== undefined ? this.keywordJumpAtStart(start, answer, isInteractiveReply) : undefined
      if (target) await this.jumpTo(turn, graph, target, context)
      else await this.runFrom(turn, { graph, nodeId: graph.startNodeId, context, enterInitialNode: true })
      return 'handled'
    }

    await this.answerNode({ turn, graph, node, context, answer, isInteractiveReply })
    return 'handled'
  }

  /** Abre um fluxo para a conversa sem esperar mensagem — ex.: ao devolver a conversa ao bot. */
  async start(params: StartFlowParams): Promise<FlowRunnerOutcome> {
    const row = await this.dependencies.sessionRepository.getContext(params.companyId, params.whatsappNumber)
    if (!row) return 'no-session'
    const turn = await this.openTurn(params.companyId, toSessionContract(row), params.profileName)
    const graph = await this.loadGraph(params.companyId, params.flowKey ?? this.startFlowKey())
    if (!graph) return 'no-flow'
    await this.runFrom(turn, {
      graph,
      nodeId: graph.startNodeId,
      context: { ...turn.session.context },
      enterInitialNode: true,
    })
    return 'handled'
  }

  private async openTurn(companyId: string, session: ConversationSession, profileName?: string): Promise<FlowTurn> {
    const resolver = this.dependencies.config.resolveVariables
    const hostVariables = resolver ? await resolver({ session, ...(profileName ? { profileName } : {}) }) : {}
    const baseVariables = { ...contactVariables(profileName), ...hostVariables }
    this.turnVariables.set(session, baseVariables)
    return { companyId, session, baseVariables }
  }

  private startFlowKey(): string {
    return this.dependencies.config.startFlowKey ?? DEFAULT_START_FLOW_KEY
  }

  private clock(): FlowClock {
    const { config } = this.dependencies
    return {
      now: config.now?.() ?? new Date(),
      locale: config.dateLocale ?? FLOW_DATE_LOCALE_PT_BR,
      ...(config.timeZone ? { timeZone: config.timeZone } : {}),
    }
  }

  private loadGraph(companyId: string, flowKey: string): Promise<FlowGraphData | undefined> {
    return this.dependencies.flowGraphRepository.get(companyId, flowKey)
  }

  private globalKeywordTarget(answer: string): FlowGlobalKeywordTarget | undefined {
    const keywords = this.dependencies.config.globalKeywords ?? []
    return keywords.find((entry) => matchesFlowKeyword(answer, entry.keywords))?.target
  }

  private keywordJumpAtStart(start: FlowNodeData, answer: string, isInteractiveReply: boolean): string | undefined {
    const decision = resolveFlowAnswer({ node: start, answer, isInteractiveReply, context: {}, clock: this.clock() })
    return decision.kind === 'jump' ? decision.target : undefined
  }

  private async applyGlobalTarget(turn: FlowTurn, target: FlowGlobalKeywordTarget): Promise<FlowRunnerOutcome> {
    const context = withRuntime({ ...turn.session.context }, {})
    if (target === 'handoff') {
      await this.handOff(turn, context)
      return 'handled'
    }
    const flowKey = target === 'restart' ? this.startFlowKey() : crossFlowKey(target)
    const graph = await this.loadGraph(turn.companyId, flowKey)
    if (!graph) return 'no-flow'
    await this.runFrom(turn, { graph, nodeId: graph.startNodeId, context, enterInitialNode: true })
    return 'handled'
  }

  private async answerNode(params: {
    turn: FlowTurn
    graph: FlowGraphData
    node: FlowNodeData
    context: Record<string, unknown>
    answer: string | undefined
    isInteractiveReply: boolean
  }): Promise<void> {
    const { turn, graph, node, context } = params
    const runtime = runtimeOf(context)
    const dynamic = runtime.dynamic?.nodeId === node.id ? runtime.dynamic : undefined
    const decision = resolveFlowAnswer({
      node,
      answer: params.answer,
      isInteractiveReply: params.isInteractiveReply,
      context,
      clock: this.clock(),
      ...(dynamic ? { dynamicOptions: dynamic.options } : {}),
    })

    if (decision.kind === 'jump') return this.jumpTo(turn, graph, decision.target, withRuntime(context, {}))
    if (decision.kind === 'see-more') {
      return this.awaitAnswer(turn, graph, node, context, (dynamic?.page ?? 0) + 1)
    }
    if (decision.kind === 'invalid') return this.handleInvalid(turn, graph, node, context, decision.rejection)

    await this.runFrom(turn, {
      graph,
      nodeId: node.id,
      context: withRuntime(context, {}),
      userAnswer: decision.userAnswer,
      ...(decision.value !== undefined ? { answerValue: decision.value } : {}),
      enterInitialNode: false,
    })
  }

  private async handleInvalid(
    turn: FlowTurn,
    graph: FlowGraphData,
    node: FlowNodeData,
    context: Record<string, unknown>,
    rejection: FlowAnswerRejection | undefined,
  ): Promise<void> {
    const runtime = runtimeOf(context)
    const attempts = (runtime.invalidAnswers ?? 0) + 1
    const limit = node.maxInvalidAnswers ?? this.dependencies.config.maxInvalidAnswers ?? DEFAULT_MAX_INVALID_ANSWERS
    if (attempts >= limit) return this.handOff(turn, withRuntime(context, {}))

    const updated = withRuntime(context, { ...runtime, invalidAnswers: attempts })
    await this.say(turn, this.fallbackText(node, rejection), updated)
    await this.awaitAnswer(turn, graph, node, updated, runtime.dynamic?.nodeId === node.id ? runtime.dynamic.page : 0)
  }

  private fallbackText(node: FlowNodeData, rejection: FlowAnswerRejection | undefined): string {
    const { config } = this.dependencies
    return (
      node.fallbackMessage ??
      (rejection ? config.rejectionMessages?.[rejection] : undefined) ??
      config.defaultFallbackMessage ??
      DEFAULT_FLOW_TEXT.FALLBACK
    )
  }

  private async handOff(turn: FlowTurn, context: Record<string, unknown>): Promise<void> {
    const isWithinHours = await this.dependencies.handoff.request({
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      variables: { ...turn.baseVariables, ...context },
    })
    await this.save(turn, {
      flowKey: null,
      nodeId: null,
      context: { ...context, handoffWithinBusinessHours: isWithinHours },
    })
  }

  private async jumpTo(
    turn: FlowTurn,
    graph: FlowGraphData,
    target: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (isCrossFlowTarget(target)) {
      const targetGraph = await this.loadGraph(turn.companyId, crossFlowKey(target))
      if (!targetGraph) return this.reportMissingFlow(turn, graph.key, target, context)
      return this.runFrom(turn, {
        graph: targetGraph,
        nodeId: targetGraph.startNodeId,
        context,
        enterInitialNode: true,
      })
    }
    return this.runFrom(turn, { graph, nodeId: target, context, enterInitialNode: true })
  }

  private async runFrom(turn: FlowTurn, initial: RunFromParams): Promise<void> {
    const maxJumps = this.dependencies.config.maxCrossFlowJumps ?? DEFAULT_MAX_CROSS_FLOW_JUMPS
    let params: RunFromParams = initial

    for (let jump = 0; jump <= maxJumps; jump++) {
      const result = await this.dependencies.interpreter.run(
        {
          graph: params.graph,
          currentNodeId: params.nodeId,
          ...(params.userAnswer !== undefined ? { userAnswer: params.userAnswer } : {}),
          ...(params.answerValue !== undefined ? { answerValue: params.answerValue } : {}),
          context: params.context,
          session: turn.session,
          channel: this.dependencies.channel,
        },
        {
          enterInitialNode: params.enterInitialNode,
          onNodeEntered: async (node, context) => {
            if (node.directMessage) await this.say(turn, node.directMessage, context)
          },
        },
      )

      if (result.kind === 'awaiting-answer') {
        const node = params.graph.nodes[result.nodeId]
        if (node) return this.awaitAnswer(turn, params.graph, node, result.context, 0)
        return this.save(turn, { flowKey: null, nodeId: null, context: result.context })
      }
      if (result.kind === 'terminal') return this.save(turn, { flowKey: null, nodeId: null, context: result.context })
      if (result.kind === 'max-steps-exceeded') {
        await this.save(turn, { flowKey: null, nodeId: null, context: result.context })
        return this.report(
          turn,
          params.graph.key,
          null,
          'max-steps',
          new FlowRunnerError('cycle', result.visited.join(' -> ')),
        )
      }

      const target = await this.loadGraph(turn.companyId, result.flowKey)
      if (!target) return this.reportMissingFlow(turn, params.graph.key, result.flowKey, result.context)
      params = { graph: target, nodeId: target.startNodeId, context: result.context, enterInitialNode: true }
    }

    await this.save(turn, { flowKey: null, nodeId: null, context: params.context })
    return this.report(
      turn,
      params.graph.key,
      null,
      'cross-flow',
      new FlowRunnerError('too-many-jumps', params.graph.key),
    )
  }

  /** Grava a posição no nó e pergunta. Para `dynamic_choice`, busca a página antes de gravar. */
  private async awaitAnswer(
    turn: FlowTurn,
    graph: FlowGraphData,
    node: FlowNodeData,
    context: Record<string, unknown>,
    page: number,
  ): Promise<void> {
    try {
      const { message, context: renderedContext } = await this.renderer.prepare({
        session: turn.session,
        variables: turn.baseVariables,
        node,
        context,
        page,
      })
      await this.save(turn, { flowKey: graph.key, nodeId: node.id, context: renderedContext })
      if (message) await this.send(turn, message)
    } catch (error) {
      await this.report(turn, graph.key, node.id, 'render', error)
    }
  }

  private async say(turn: FlowTurn, template: string, context: Record<string, unknown>): Promise<void> {
    const body = this.renderer.interpolate(template, { ...turn.baseVariables, ...context })
    if (body.trim().length > 0) await this.send(turn, { kind: 'text', body })
  }

  private async send(turn: FlowTurn, message: FlowOutboundMessage): Promise<void> {
    const common = {
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      sender: 'bot' as const,
      startState: this.dependencies.startState,
    }
    if (message.kind === 'text') await this.dependencies.sendMessage.sendText({ ...common, body: message.body })
    else await this.dependencies.sendMessage.sendInteractive({ ...common, interactive: message.interactive })
  }

  private save(
    turn: FlowTurn,
    progress: { flowKey: string | null; nodeId: string | null; context: Record<string, unknown> },
  ): Promise<void> {
    return this.dependencies.sessionRepository.saveFlowProgress(turn.companyId, turn.session.whatsappNumber, {
      flowKey: progress.flowKey,
      currentNodeId: progress.nodeId,
      context: progress.context,
    })
  }

  private async reportMissingFlow(
    turn: FlowTurn,
    fromFlowKey: string,
    target: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    await this.save(turn, { flowKey: null, nodeId: null, context })
    await this.report(turn, fromFlowKey, null, 'cross-flow', new FlowRunnerError('flow-not-found', target))
  }

  private async report(
    turn: FlowTurn,
    flowKey: string | null,
    nodeId: string | null,
    stage: 'render' | 'cross-flow' | 'max-steps',
    error: unknown,
  ): Promise<void> {
    const hook = this.dependencies.hooks?.onFlowRunnerError
    if (!hook) throw error
    await hook(error, {
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      flowKey,
      nodeId,
      stage,
    })
  }
}
