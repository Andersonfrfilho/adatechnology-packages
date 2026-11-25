/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Encaminhamento a uma pessoa: põe a conversa na fila (`requestHuman`, que dispara
 * `onHumanRequested` e `onConversationModeChanged`) e avisa o cliente com o texto certo para a hora.
 *
 * Um só caminho para os três gatilhos — o nó `handoff`, a palavra global e o excesso de respostas
 * inválidas. Três cópias divergiriam no texto e no horário.
 */

import {
  interpolateFlowText,
  isWithinBusinessHours,
  type BusinessHours,
  type ConversationSession,
  type FlowActionHandler,
  type FlowNodeData,
  type InterpolateFlowTextOptions,
  type MetaWhatsAppHooks,
  type SessionState,
} from '@adatechnology/meta-whatsapp-contracts'
import type { RequestHumanConversationUseCase } from '../use-cases/RequestHumanConversation.use-case'
import type { SendMessageUseCase } from '../use-cases/SendMessage.use-case'
import { DEFAULT_FLOW_TEXT } from './flowRunner.constant'
import type { FlowHandoffConfig } from './flowRunner.types'

export type FlowHandoffDependencies = {
  readonly requestHuman: RequestHumanConversationUseCase
  readonly sendMessage: SendMessageUseCase
  readonly startState: SessionState
  readonly config: FlowHandoffConfig
  readonly now: () => Date
  readonly interpolation: InterpolateFlowTextOptions
  readonly hooks?: Pick<MetaWhatsAppHooks, 'onFlowRunnerError'>
}

export type RequestFlowHandoffParams = {
  readonly companyId: string
  readonly whatsappNumber: string
  readonly variables: Readonly<Record<string, unknown>>
  readonly node?: FlowNodeData
}

function readParam(node: FlowNodeData | undefined, key: string): string | undefined {
  const value = node?.actionParams?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export class FlowHandoff {
  constructor(private readonly dependencies: FlowHandoffDependencies) {}

  /** Devolve se caiu dentro do horário — vai para o contexto como `handoffWithinBusinessHours`. */
  async request(params: RequestFlowHandoffParams): Promise<boolean> {
    const { requestHuman, sendMessage, startState, interpolation } = this.dependencies
    // Falha na fila ou nos ganchos (`onHumanRequested`, auditoria) não pode deixar o cliente sem
    // resposta: reporta e segue para a mensagem. Retentativa não reavisa — o turno já foi gravado.
    try {
      await requestHuman.execute({ companyId: params.companyId, whatsappNumber: params.whatsappNumber })
    } catch (error) {
      await this.reportFailure(error, params)
    }

    const isWithinHours = await this.isWithinHours(params.companyId)
    const template = this.messageFor(isWithinHours, params.node)
    await sendMessage.sendText({
      companyId: params.companyId,
      whatsappNumber: params.whatsappNumber,
      body: interpolateFlowText(template, params.variables, interpolation),
      sender: 'bot',
      startState,
    })
    return isWithinHours
  }

  /**
   * Handler do `actionKind: 'handoff'`. `actionParams.message` e `actionParams.outOfHoursMessage`
   * sobrescrevem os textos do runner para aquele nó.
   */
  createActionHandler(
    resolveVariables: (params: {
      session: ConversationSession
      context: Record<string, unknown>
    }) => Record<string, unknown>,
  ): FlowActionHandler {
    return async ({ node, session, context }) => {
      const isWithinHours = await this.request({
        companyId: session.companyId,
        whatsappNumber: session.whatsappNumber,
        variables: resolveVariables({ session, context }),
        node,
      })
      return { context: { handoffWithinBusinessHours: isWithinHours } }
    }
  }

  private async reportFailure(error: unknown, params: RequestFlowHandoffParams): Promise<void> {
    try {
      await this.dependencies.hooks?.onFlowRunnerError?.(error, {
        companyId: params.companyId,
        whatsappNumber: params.whatsappNumber,
        flowKey: null,
        nodeId: params.node?.id ?? null,
        stage: 'handoff',
      })
    } catch {
      // Gancho de observabilidade com defeito não pode impedir o aviso ao cliente.
    }
  }

  private async isWithinHours(companyId: string): Promise<boolean> {
    const source = this.dependencies.config.businessHours
    const hours: BusinessHours | undefined = typeof source === 'function' ? await source(companyId) : source
    return hours ? isWithinBusinessHours(hours, this.dependencies.now()) : true
  }

  private messageFor(isWithinHours: boolean, node: FlowNodeData | undefined): string {
    const { config } = this.dependencies
    const inHours = readParam(node, 'message') ?? config.message ?? DEFAULT_FLOW_TEXT.HANDOFF
    if (isWithinHours) return inHours
    return (
      readParam(node, 'outOfHoursMessage') ??
      config.outOfHoursMessage ??
      readParam(node, 'message') ??
      config.message ??
      DEFAULT_FLOW_TEXT.HANDOFF_OUT_OF_HOURS
    )
  }
}
