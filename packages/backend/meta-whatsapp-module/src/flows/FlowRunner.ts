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
  ConfigMissingError,
  FLOW_DATE_LOCALE_PT_BR,
  FlowRunnerError,
  isCrossFlowTarget,
  crossFlowKey,
  type ChannelAdapterInterface,
  type ConversationSession,
  type DynamicChoiceProvider,
  type FlowAnswerRejection,
  type FlowClock,
  type FlowGraphData,
  type FlowNodeData,
  type FlowRunnerErrorDetails,
  type FlowSendFailureDetails,
  type MetaWhatsAppHooks,
  type SessionState,
  type WhatsAppMessage,
} from '@adatechnology/meta-whatsapp-contracts'
import type { FlowGraphRepository } from '../repositories/FlowGraphRepository'
import type { SessionRepository } from '../repositories/SessionRepository'
import type { SendMessageUseCase } from '../use-cases/SendMessage.use-case'
import { toSessionContract } from '../channel/inboundDispatch'
import type { FlowInterpreter } from './FlowInterpreter'
import type { FlowHandoff } from './FlowHandoff'
import type { FlowOutboundMessage } from './buildFlowChoiceMessage'
import { isChoiceNode, resolveFlowAnswer } from './resolveFlowAnswer'
import { FlowQuestionRenderer } from './FlowQuestionRenderer'
import { runtimeOf, withRuntime } from './flowRuntimeState'
import type { FlowTurnLockInterface } from './flowTurnLock'
import { readFlowInbound, type FlowInbound } from './readFlowInbound'
import {
  DEFAULT_FLOW_TEXT,
  DEFAULT_MAX_CROSS_FLOW_JUMPS,
  DEFAULT_MAX_INVALID_ANSWERS,
  DEFAULT_START_FLOW_KEY,
} from './flowRunner.constant'
import { matchGlobalKeyword } from './matchGlobalKeyword'
import type {
  FlowConfigText,
  FlowGlobalKeywordTarget,
  FlowRunnerConfig,
  FlowRunnerOutcome,
  FlowTextContext,
} from './flowRunner.types'
import { resolveFlowConfigText } from './resolveFlowConfigText'
import { SendRetriesExhausted, sendWithRetry } from './sendWithRetry'

export type FlowRunnerDependencies = {
  readonly interpreter: FlowInterpreter
  readonly flowGraphRepository: Pick<FlowGraphRepository, 'get'>
  readonly sessionRepository: SessionRepository
  readonly sendMessage: SendMessageUseCase
  readonly channel: ChannelAdapterInterface
  readonly handoff: FlowHandoff
  readonly lock: FlowTurnLockInterface
  readonly startState: SessionState
  readonly config: FlowRunnerConfig
  readonly hooks?: Pick<MetaWhatsAppHooks, 'onFlowRunnerError'>
}

/**
 * Uma mensagem sendo atendida. `isClaimed` vira `true` na primeira escrita do turno, que já grava o
 * id da mensagem: dali em diante nenhum erro sobe (a fila repetiria o turno e reenviaria o que já
 * saiu) — vai para `onFlowRunnerError`.
 */
type FlowTurn = {
  readonly companyId: string
  readonly session: ConversationSession
  readonly baseVariables: Readonly<Record<string, unknown>>
  readonly inboundId?: string
  isClaimed: boolean
}

type RunFromParams = {
  readonly graph: FlowGraphData
  readonly nodeId: string
  readonly context: Record<string, unknown>
  readonly userAnswer?: string
  readonly answerValue?: unknown
  readonly enterInitialNode: boolean
}

type FlowStage = FlowRunnerErrorDetails['stage']

/** Por que a resposta foi recusada, e o texto pontual do validador do host, se ele mandou um. */
type FlowInvalidAnswer = {
  readonly rejection?: FlowAnswerRejection
  readonly message?: string
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

/** Fuso do runner: o configurado, ou o do horário de atendimento fixo. Sem nenhum, falha no boot. */
export function resolveFlowTimeZone(config: FlowRunnerConfig): string {
  const businessHours = config.handoff?.businessHours
  const timeZone = config.timeZone ?? (typeof businessHours === 'object' ? businessHours.timeZone : undefined)
  if (!timeZone) throw new ConfigMissingError('features.flowRunner.timeZone')
  new Intl.DateTimeFormat('en-US', { timeZone })
  return timeZone
}

export class FlowRunner {
  private readonly renderer: FlowQuestionRenderer
  private readonly timeZone: string
  // Variáveis da mensagem em curso, por sessão: é como a action `handoff` (que só recebe a sessão)
  // enxerga o nome do contato sem que ele precise ir para o contexto gravado.
  private readonly turnVariables = new WeakMap<ConversationSession, Readonly<Record<string, unknown>>>()
  // Erro de envio já sem retentativa → o que se tentou, para `report` entregar ao host sem trocar o erro.
  private readonly sendFailures = new WeakMap<object, FlowSendFailureDetails>()

  constructor(private readonly dependencies: FlowRunnerDependencies) {
    this.renderer = new FlowQuestionRenderer(dependencies.config)
    this.timeZone = resolveFlowTimeZone(dependencies.config)
  }

  registerDynamicChoiceProvider(key: string, provider: DynamicChoiceProvider): void {
    this.renderer.registerDynamicChoiceProvider(key, provider)
  }

  /**
   * Variáveis para `{{chave}}`. As do host (`resolveVariables`, `contactName`, `contactFirstName`)
   * vencem as respostas do cliente: um `contextKey` chamado `contactName` não pode trocar o nome que
   * o sistema conhece pelo que o cliente digitou.
   */
  variablesFor(params: { session: ConversationSession; context: Record<string, unknown> }): Record<string, unknown> {
    return { ...params.context, ...(this.turnVariables.get(params.session) ?? {}) }
  }

  /** Atende uma mensagem. Um turno por conversa de cada vez (`lock`); reentrega da mesma mensagem é ignorada. */
  handle(params: HandleFlowMessageParams): Promise<FlowRunnerOutcome> {
    const key = { companyId: params.companyId, whatsappNumber: params.message.from }
    return this.dependencies.lock.withLock(key, () => this.handleLocked(params))
  }

  /** Abre um fluxo para a conversa sem esperar mensagem — ex.: ao devolver a conversa ao bot. */
  start(params: StartFlowParams): Promise<FlowRunnerOutcome> {
    const key = { companyId: params.companyId, whatsappNumber: params.whatsappNumber }
    return this.dependencies.lock.withLock(key, async () => {
      const row = await this.dependencies.sessionRepository.getContext(params.companyId, params.whatsappNumber)
      if (!row) return 'no-session'
      const turn = await this.openTurn({
        companyId: params.companyId,
        session: toSessionContract(row),
        ...(params.profileName ? { profileName: params.profileName } : {}),
      })
      const graph = await this.loadGraph(params.companyId, params.flowKey ?? this.startFlowKey())
      if (!graph) return 'no-flow'
      turn.isClaimed = true
      return this.guard(turn, async () => {
        await this.runFrom(turn, {
          graph,
          nodeId: graph.startNodeId,
          context: { ...turn.session.context },
          enterInitialNode: true,
        })
        return 'handled'
      })
    })
  }

  private async handleLocked(params: HandleFlowMessageParams): Promise<FlowRunnerOutcome> {
    const row = await this.dependencies.sessionRepository.getContext(params.companyId, params.message.from)
    if (!row) return 'no-session'
    if (row.mode === 'human') return 'human-mode'
    const session = toSessionContract(row)
    if (runtimeOf(session.context).lastInboundId === params.message.id) return 'duplicate'

    const turn = await this.openTurn({
      companyId: params.companyId,
      session,
      inboundId: params.message.id,
      ...(params.profileName ? { profileName: params.profileName } : {}),
    })
    return this.guard(turn, () => this.route(turn, readFlowInbound(params.message)))
  }

  private async route(turn: FlowTurn, inbound: FlowInbound): Promise<FlowRunnerOutcome> {
    const globalTarget = inbound.kind === 'text' ? this.globalKeywordTarget(inbound.answer) : undefined
    if (globalTarget) return this.applyGlobalTarget(turn, globalTarget)

    const whileAwaitingHuman = this.dependencies.config.whileAwaitingHuman ?? 'silent'
    if (turn.session.humanRequestedAt && !turn.session.currentNodeId && whileAwaitingHuman === 'silent') {
      return 'awaiting-human'
    }

    const savedFlowKey = turn.session.flowKey
    const savedGraph = await this.loadGraph(turn.companyId, savedFlowKey ?? this.startFlowKey())
    const isStale = !savedGraph && savedFlowKey !== null && savedFlowKey !== this.startFlowKey()
    const graph = savedGraph ?? (isStale ? await this.loadGraph(turn.companyId, this.startFlowKey()) : undefined)
    if (!graph) return 'no-flow'

    await this.claim(turn)
    if (isStale)
      await this.report(
        turn,
        savedFlowKey,
        turn.session.currentNodeId,
        'cross-flow',
        new FlowRunnerError('flow-not-found', savedFlowKey),
      )

    const node = !isStale && turn.session.currentNodeId ? graph.nodes[turn.session.currentNodeId] : undefined
    const context = { ...turn.session.context }
    if (node) {
      await this.answerNode({ turn, graph, node, context, inbound })
      return 'handled'
    }

    const start = graph.nodes[graph.startNodeId]
    const target = start && inbound.kind !== 'unsupported' ? this.keywordJumpAtStart(start, inbound) : undefined
    if (target) await this.jumpTo(turn, graph, target, context)
    else await this.runFrom(turn, { graph, nodeId: graph.startNodeId, context, enterInitialNode: true })
    return 'handled'
  }

  private async guard(turn: FlowTurn, work: () => Promise<FlowRunnerOutcome>): Promise<FlowRunnerOutcome> {
    try {
      return await work()
    } catch (error) {
      if (!turn.isClaimed) throw error
      await this.report(turn, turn.session.flowKey, turn.session.currentNodeId, 'turn', error)
      return 'handled'
    }
  }

  /** Primeira escrita do turno: grava o id da mensagem antes de qualquer efeito externo. */
  private async claim(turn: FlowTurn): Promise<void> {
    if (turn.isClaimed) return
    await this.save(turn, {
      flowKey: turn.session.flowKey,
      nodeId: turn.session.currentNodeId,
      context: { ...turn.session.context },
    })
    turn.isClaimed = true
  }

  private async openTurn(params: {
    companyId: string
    session: ConversationSession
    inboundId?: string
    profileName?: string
  }): Promise<FlowTurn> {
    const { session, profileName } = params
    const resolver = this.dependencies.config.resolveVariables
    const hostVariables = resolver ? await resolver({ session, ...(profileName ? { profileName } : {}) }) : {}
    const baseVariables = { ...contactVariables(profileName), ...hostVariables }
    this.turnVariables.set(session, baseVariables)
    return {
      companyId: params.companyId,
      session,
      baseVariables,
      ...(params.inboundId ? { inboundId: params.inboundId } : {}),
      isClaimed: false,
    }
  }

  private startFlowKey(): string {
    return this.dependencies.config.startFlowKey ?? DEFAULT_START_FLOW_KEY
  }

  private clock(): FlowClock {
    const { config } = this.dependencies
    return {
      now: config.now?.() ?? new Date(),
      locale: config.dateLocale ?? FLOW_DATE_LOCALE_PT_BR,
      timeZone: this.timeZone,
    }
  }

  private loadGraph(companyId: string, flowKey: string): Promise<FlowGraphData | undefined> {
    return this.dependencies.flowGraphRepository.get(companyId, flowKey)
  }

  private globalKeywordTarget(answer: string): FlowGlobalKeywordTarget | undefined {
    return matchGlobalKeyword(answer, this.dependencies.config.globalKeywords ?? [])
  }

  private keywordJumpAtStart(start: FlowNodeData, inbound: FlowInbound): string | undefined {
    if (inbound.kind === 'unsupported') return undefined
    const decision = resolveFlowAnswer({
      node: start,
      answer: inbound.answer,
      isInteractiveReply: inbound.kind === 'reply',
      context: {},
      clock: this.clock(),
    })
    return decision.kind === 'jump' ? decision.target : undefined
  }

  /**
   * Palavra global vale mesmo com a conversa aguardando atendimento. Reiniciar NÃO tira o pedido da
   * fila (`humanRequestedAt` continua): a equipe ainda responde, e o cliente pode usar o bot enquanto
   * espera; quando o fluxo terminar, o runner volta ao silêncio.
   */
  private async applyGlobalTarget(turn: FlowTurn, target: FlowGlobalKeywordTarget): Promise<FlowRunnerOutcome> {
    const context = withRuntime({ ...turn.session.context }, {})
    if (target === 'handoff') {
      await this.claim(turn)
      await this.handOff(turn, context)
      return 'handled'
    }
    const flowKey = target === 'restart' ? this.startFlowKey() : crossFlowKey(target)
    const graph = await this.loadGraph(turn.companyId, flowKey)
    if (!graph) return 'no-flow'
    await this.claim(turn)
    await this.runFrom(turn, { graph, nodeId: graph.startNodeId, context, enterInitialNode: true })
    return 'handled'
  }

  private async answerNode(params: {
    turn: FlowTurn
    graph: FlowGraphData
    node: FlowNodeData
    context: Record<string, unknown>
    inbound: FlowInbound
  }): Promise<void> {
    const { turn, graph, node, context, inbound } = params
    const runtime = runtimeOf(context)
    const dynamic = runtime.dynamic?.nodeId === node.id ? runtime.dynamic : undefined
    const page = dynamic?.page ?? 0

    if (inbound.kind === 'unsupported') {
      const text = await this.configText(turn, node, {
        chain: [this.dependencies.config.nonTextAnswerMessage],
        kind: 'non-text-answer',
      })
      await this.say(turn, text ?? DEFAULT_FLOW_TEXT.NON_TEXT_ANSWER, context)
      return this.awaitAnswer(turn, graph, node, context, page)
    }

    const decision = resolveFlowAnswer({
      node,
      answer: inbound.answer,
      isInteractiveReply: inbound.kind === 'reply',
      context,
      clock: this.clock(),
      ...(dynamic ? { dynamicOptions: dynamic.options } : {}),
      ...(isChoiceNode(node) ? { options: this.renderedOptions(turn, node, context) } : {}),
    })

    if (decision.kind === 'jump') return this.jumpTo(turn, graph, decision.target, withRuntime(context, {}))
    if (decision.kind === 'see-more') return this.awaitAnswer(turn, graph, node, context, page + 1)
    if (decision.kind === 'invalid' && this.followsDefaultWhenUnmatched(node)) {
      return this.runFrom(turn, {
        graph,
        nodeId: node.id,
        context: withRuntime(context, {}),
        userAnswer: inbound.answer,
        enterInitialNode: false,
      })
    }
    if (decision.kind === 'invalid') {
      return this.handleInvalid(turn, graph, node, context, { rejection: decision.rejection })
    }

    const hostRejection = await this.validateWithHost(turn, node, context, {
      answer: inbound.answer,
      value: decision.value,
    })
    if (hostRejection) return this.handleInvalid(turn, graph, node, context, hostRejection)

    await this.runFrom(turn, {
      graph,
      nodeId: node.id,
      context: withRuntime(context, {}),
      userAnswer: decision.userAnswer,
      ...(decision.value !== undefined ? { answerValue: decision.value } : {}),
      enterInitialNode: false,
    })
  }

  /** Títulos como o cliente os viu (`{{chave}}` resolvido): é contra eles que o texto digitado casa. */
  private renderedOptions(
    turn: FlowTurn,
    node: FlowNodeData,
    context: Record<string, unknown>,
  ): (readonly [string, string])[] {
    const variables = { ...context, ...turn.baseVariables }
    return (node.options ?? []).map(([id, title]) => [id, this.renderer.interpolate(title, variables)] as const)
  }

  /**
   * Validador do host, só para pergunta (escolha já casou com opção) e nunca para resposta pulada.
   * Falha do validador não pode prender o cliente na pergunta: reporta e aceita.
   */
  private async validateWithHost(
    turn: FlowTurn,
    node: FlowNodeData,
    context: Record<string, unknown>,
    answer: { answer: string; value: unknown },
  ): Promise<FlowInvalidAnswer | undefined> {
    const validator = this.dependencies.config.validateAnswer
    if (!validator || isChoiceNode(node) || node.type === 'dynamic_choice' || answer.value === null) return undefined
    try {
      const result = await validator({
        companyId: turn.companyId,
        session: turn.session,
        node,
        answer: answer.answer.trim(),
        value: answer.value ?? answer.answer,
        context,
      })
      if (!result || result.isValid) return undefined
      return { rejection: 'rejected-by-host', ...(result.message ? { message: result.message } : {}) }
    } catch (error) {
      await this.report(turn, turn.session.flowKey, node.id, 'validate-answer', error)
      return undefined
    }
  }

  private configText(
    turn: FlowTurn,
    node: FlowNodeData | undefined,
    params: {
      chain: readonly (FlowConfigText | undefined)[]
      kind: FlowTextContext['kind']
      rejection?: FlowAnswerRejection
    },
  ): Promise<string | undefined> {
    return resolveFlowConfigText({
      chain: params.chain,
      context: {
        companyId: turn.companyId,
        whatsappNumber: turn.session.whatsappNumber,
        kind: params.kind,
        flowKey: turn.session.flowKey,
        ...(node ? { nodeId: node.id } : {}),
        ...(params.rejection ? { rejection: params.rejection } : {}),
      },
      onError: (error) => this.report(turn, turn.session.flowKey, node?.id ?? null, 'text', error),
    })
  }

  private followsDefaultWhenUnmatched(node: FlowNodeData): boolean {
    if (!isChoiceNode(node)) return false
    return (node.unmatchedChoice ?? this.dependencies.config.unmatchedChoice ?? 'reask') === 'default'
  }

  private async handleInvalid(
    turn: FlowTurn,
    graph: FlowGraphData,
    node: FlowNodeData,
    context: Record<string, unknown>,
    invalid: FlowInvalidAnswer,
  ): Promise<void> {
    const runtime = runtimeOf(context)
    const attempts = (runtime.invalidAnswers ?? 0) + 1
    const limit = node.maxInvalidAnswers ?? this.dependencies.config.maxInvalidAnswers ?? DEFAULT_MAX_INVALID_ANSWERS
    if (attempts >= limit) return this.handOff(turn, withRuntime(context, {}))

    const updated = withRuntime(context, { ...runtime, invalidAnswers: attempts })
    await this.say(turn, await this.fallbackText(turn, node, invalid), updated)
    await this.awaitAnswer(turn, graph, node, updated, runtime.dynamic?.nodeId === node.id ? runtime.dynamic.page : 0)
  }

  /** Precedência: texto do validador do host, `fallbackMessage` do nó, texto do motivo, padrão do host, do pacote. */
  private async fallbackText(turn: FlowTurn, node: FlowNodeData, invalid: FlowInvalidAnswer): Promise<string> {
    const { config } = this.dependencies
    const fixed = invalid.message ?? node.fallbackMessage
    if (fixed !== undefined) return fixed
    const { rejection } = invalid
    const byRejection = rejection
      ? await this.configText(turn, node, {
          chain: [config.rejectionMessages?.[rejection]],
          kind: 'rejection',
          rejection,
        })
      : undefined
    if (byRejection !== undefined) return byRejection
    const fallback = await this.configText(turn, node, { chain: [config.defaultFallbackMessage], kind: 'fallback' })
    return fallback ?? DEFAULT_FLOW_TEXT.FALLBACK
  }

  private async handOff(turn: FlowTurn, context: Record<string, unknown>): Promise<void> {
    const isWithinHours = await this.dependencies.handoff.request({
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      variables: { ...context, ...turn.baseVariables },
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
    const body = this.renderer.interpolate(template, { ...context, ...turn.baseVariables })
    if (body.trim().length > 0) await this.send(turn, { kind: 'text', body })
  }

  /**
   * Cada mensagem é retentada sozinha (ver `sendWithRetry`): o que já saiu neste turno não é reenviado.
   * Esgotadas as tentativas, o erro original sobe como antes e o `report` ganha `details.send`.
   */
  private async send(turn: FlowTurn, message: FlowOutboundMessage): Promise<void> {
    const common = {
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      sender: 'bot' as const,
      startState: this.dependencies.startState,
    }
    const deliver = async (): Promise<void> => {
      if (message.kind === 'text') await this.dependencies.sendMessage.sendText({ ...common, body: message.body })
      else await this.dependencies.sendMessage.sendInteractive({ ...common, interactive: message.interactive })
    }
    try {
      await sendWithRetry(deliver, this.dependencies.config.sendRetry)
    } catch (failure) {
      if (!(failure instanceof SendRetriesExhausted)) throw failure
      if (typeof failure.error === 'object' && failure.error !== null) {
        this.sendFailures.set(failure.error, {
          attempts: failure.attempts,
          messageKind: message.kind,
          isTransient: failure.isTransient,
        })
      }
      throw failure.error
    }
  }

  private save(
    turn: FlowTurn,
    progress: { flowKey: string | null; nodeId: string | null; context: Record<string, unknown> },
  ): Promise<void> {
    // Toda escrita do turno carrega o id da mensagem: é o que faz a retentativa parar no `duplicate`.
    const runtime = runtimeOf(progress.context)
    const context = turn.inboundId
      ? withRuntime(progress.context, { ...runtime, lastInboundId: turn.inboundId })
      : progress.context
    return this.dependencies.sessionRepository.saveFlowProgress(turn.companyId, turn.session.whatsappNumber, {
      flowKey: progress.flowKey,
      currentNodeId: progress.nodeId,
      context,
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

  /**
   * Nunca relança: só é chamado depois de o turno ter sido gravado, e relançar faria a fila repetir
   * uma mensagem já marcada como tratada. Sem gancho, o erro é descartado (a conversa fica no último
   * ponto gravado e a próxima mensagem do cliente segue dali); gancho que falha também não derruba.
   */
  private async report(
    turn: FlowTurn,
    flowKey: string | null,
    nodeId: string | null,
    stage: FlowStage,
    error: unknown,
  ): Promise<void> {
    const send = typeof error === 'object' && error !== null ? this.sendFailures.get(error) : undefined
    const details = {
      companyId: turn.companyId,
      whatsappNumber: turn.session.whatsappNumber,
      flowKey,
      nodeId,
      stage,
      ...(send ? { send } : {}),
    }
    try {
      await this.dependencies.hooks?.onFlowRunnerError?.(error, details)
    } catch {
      // Gancho de observabilidade com defeito não pode transformar um erro reportado em mensagem reprocessada.
    }
  }
}
