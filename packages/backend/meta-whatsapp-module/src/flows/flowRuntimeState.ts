/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Estado do runner guardado no contexto da conversa (`__flow`): tentativas inválidas no nó atual e a
 * última página exibida de um `dynamic_choice` — o que o texto "2" precisa para virar um id.
 */

import { FLOW_RUNTIME_CONTEXT_KEY } from './flowRunner.constant'

export type FlowRuntimeState = {
  /** Última mensagem do cliente já tratada — reentrega e retentativa da fila param aqui. */
  readonly lastInboundId?: string
  readonly invalidAnswers?: number
  readonly dynamic?: { readonly nodeId: string; readonly page: number; readonly options: [string, string][] }
}

export function runtimeOf(context: Readonly<Record<string, unknown>>): FlowRuntimeState {
  const state = context[FLOW_RUNTIME_CONTEXT_KEY]
  return state !== null && typeof state === 'object' ? (state as FlowRuntimeState) : {}
}

export function withRuntime(context: Record<string, unknown>, state: FlowRuntimeState): Record<string, unknown> {
  return { ...context, [FLOW_RUNTIME_CONTEXT_KEY]: state }
}
