/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Nó em que a conversa parou → mensagem a enviar: texto da pergunta, botões/lista das opções (com
 * `{{chave}}` resolvido) ou a página atual de um `dynamic_choice`, buscada no provedor do host.
 */

import {
  FlowRunnerError,
  WHATSAPP_CHOICE_LIMIT,
  interpolateFlowText,
  type ConversationSession,
  type DynamicChoiceProvider,
  type FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import { buildFlowChoiceMessage, type FlowChoiceOption, type FlowOutboundMessage } from './buildFlowChoiceMessage'
import { DEFAULT_FLOW_TEXT, DYNAMIC_CHOICE_MORE_ID } from './flowRunner.constant'
import type { FlowRunnerConfig } from './flowRunner.types'
import { isChoiceNode } from './resolveFlowAnswer'
import { runtimeOf, withRuntime } from './flowRuntimeState'

export type PrepareFlowQuestionParams = {
  readonly session: ConversationSession
  readonly variables: Readonly<Record<string, unknown>>
  readonly node: FlowNodeData
  readonly context: Record<string, unknown>
  readonly page: number
}

export type PreparedFlowQuestion = {
  readonly message?: FlowOutboundMessage
  /** Contexto a gravar — o de `dynamic_choice` leva a página exibida. */
  readonly context: Record<string, unknown>
}

export class FlowQuestionRenderer {
  private readonly providers = new Map<string, DynamicChoiceProvider>()

  constructor(private readonly config: FlowRunnerConfig) {
    for (const [key, provider] of Object.entries(config.dynamicChoiceProviders ?? {})) this.providers.set(key, provider)
  }

  registerDynamicChoiceProvider(key: string, provider: DynamicChoiceProvider): void {
    this.providers.set(key, provider)
  }

  interpolate(text: string, variables: Readonly<Record<string, unknown>>): string {
    return interpolateFlowText(text, variables, this.config.formatValue ? { formatValue: this.config.formatValue } : {})
  }

  async prepare(params: PrepareFlowQuestionParams): Promise<PreparedFlowQuestion> {
    const { node, context } = params
    const variables = { ...params.variables, ...context }
    const body = this.interpolate(
      node.question ?? this.config.choicePrompt ?? DEFAULT_FLOW_TEXT.CHOICE_PROMPT,
      variables,
    )
    const listButtonLabel = node.listButtonLabel ?? this.config.listButtonLabel ?? DEFAULT_FLOW_TEXT.LIST_BUTTON_LABEL

    if (node.type === 'dynamic_choice') {
      const options = await this.loadDynamicOptions(params)
      const shown = options.map((option): [string, string] => [option.id, option.title])
      const state = { ...runtimeOf(context), dynamic: { nodeId: node.id, page: params.page, options: shown } }
      return {
        message: buildFlowChoiceMessage({ body, options, listButtonLabel }),
        context: withRuntime(context, state),
      }
    }

    if (isChoiceNode(node) && (node.options?.length ?? 0) > 0) {
      const options: FlowChoiceOption[] = (node.options ?? []).map(([id, title]) => {
        const detail = node.optionDetails?.[id]
        return {
          id,
          title: this.interpolate(title, variables),
          ...(detail?.description ? { description: this.interpolate(detail.description, variables) } : {}),
          ...(detail?.section ? { section: detail.section } : {}),
        }
      })
      return { message: buildFlowChoiceMessage({ body, options, listButtonLabel }), context }
    }

    if (!node.question) return { context }
    return { message: { kind: 'text', body }, context }
  }

  private async loadDynamicOptions(params: PrepareFlowQuestionParams): Promise<FlowChoiceOption[]> {
    const { node } = params
    const provider = node.choiceProvider ? this.providers.get(node.choiceProvider) : undefined
    if (!provider) throw new FlowRunnerError('provider-missing', node.choiceProvider ?? node.id)
    const pageSize = WHATSAPP_CHOICE_LIMIT.LIST_ROWS - 1
    const result = await provider({
      node,
      session: params.session,
      context: params.context,
      page: params.page,
      pageSize,
    })
    const options: FlowChoiceOption[] = result.options.slice(0, pageSize).map((option) => ({
      id: option.id,
      title: option.title,
      ...(option.description ? { description: option.description } : {}),
    }))
    const seeMore = this.config.seeMoreLabel ?? DEFAULT_FLOW_TEXT.SEE_MORE
    return result.hasMore ? [...options, { id: DYNAMIC_CHOICE_MORE_ID, title: seeMore }] : options
  }
}
