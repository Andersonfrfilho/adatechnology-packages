/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * O que a mensagem do cliente significa para o nó em que a conversa parou. Pura: o runner decide o
 * que fazer com a decisão (avançar, saltar, pedir de novo).
 */

import {
  matchFlowChoice,
  matchFlowKeywordRoute,
  validateFlowAnswer,
  type FlowAnswerRejection,
  type FlowClock,
  type FlowNodeData,
} from '@adatechnology/meta-whatsapp-contracts'
import { DYNAMIC_CHOICE_MORE_ID, DYNAMIC_CHOICE_PREVIOUS_ID } from './flowRunner.constant'

export type FlowAnswerDecision =
  | { readonly kind: 'answer'; readonly userAnswer: string; readonly value?: unknown }
  | { readonly kind: 'jump'; readonly target: string }
  | { readonly kind: 'see-more' }
  | { readonly kind: 'see-previous' }
  | { readonly kind: 'invalid'; readonly rejection?: FlowAnswerRejection }

export type ResolveFlowAnswerParams = {
  readonly node: FlowNodeData
  /** Texto, ou o id de botão/linha. `undefined` para mídia, localização e afins. */
  readonly answer: string | undefined
  /** Veio de toque em botão/lista — o id é confiável e não passa por casamento de texto. */
  readonly isInteractiveReply: boolean
  readonly context: Readonly<Record<string, unknown>>
  readonly clock: FlowClock
  /**
   * Opções do nó de escolha como o cliente as viu (`{{chave}}` já resolvido). Ausente, `node.options`
   * cru — o texto digitado casaria com o título ainda com a marcação.
   */
  readonly options?: readonly (readonly [string, string])[]
  /** Opções exibidas na última página de um `dynamic_choice` (id, título), incluindo "ver mais". */
  readonly dynamicOptions?: readonly (readonly [string, string])[]
}

export function isChoiceNode(node: FlowNodeData): boolean {
  return node.type === 'menu' || node.questionType === 'choice'
}

function keywordRoute(node: FlowNodeData, answer: string, isInteractiveReply: boolean): string | undefined {
  if (isInteractiveReply || typeof node.next !== 'object' || !node.next.byKeyword) return undefined
  return matchFlowKeywordRoute(answer, node.next.byKeyword)
}

function matchOption(
  answer: string,
  options: readonly (readonly [string, string])[],
  isInteractiveReply: boolean,
  matchByPosition: boolean | undefined,
): string | undefined {
  if (isInteractiveReply) return options.some(([id]) => id === answer) ? answer : undefined
  return matchFlowChoice(answer, options, { matchByPosition })
}

function resolveChoice(params: ResolveFlowAnswerParams, answer: string): FlowAnswerDecision {
  const optionId = matchOption(answer, params.options ?? params.node.options ?? [], params.isInteractiveReply, params.node.matchByPosition)
  if (optionId) return { kind: 'answer', userAnswer: optionId }
  const target = keywordRoute(params.node, answer, params.isInteractiveReply)
  return target ? { kind: 'jump', target } : { kind: 'invalid' }
}

function resolveDynamicChoice(params: ResolveFlowAnswerParams, answer: string): FlowAnswerDecision {
  const optionId = matchOption(answer, params.dynamicOptions ?? [], params.isInteractiveReply, params.node.matchByPosition)
  if (optionId === DYNAMIC_CHOICE_MORE_ID) return { kind: 'see-more' }
  if (optionId === DYNAMIC_CHOICE_PREVIOUS_ID) return { kind: 'see-previous' }
  if (optionId) return { kind: 'answer', userAnswer: optionId }
  const target = keywordRoute(params.node, answer, params.isInteractiveReply)
  return target ? { kind: 'jump', target } : { kind: 'invalid' }
}

function resolveQuestion(params: ResolveFlowAnswerParams, answer: string): FlowAnswerDecision {
  const target = keywordRoute(params.node, answer, params.isInteractiveReply)
  if (target) return { kind: 'jump', target }
  const result = validateFlowAnswer({ node: params.node, answer, context: params.context, clock: params.clock })
  if (!result.isValid) return { kind: 'invalid', rejection: result.rejection }
  return { kind: 'answer', userAnswer: answer, value: result.value }
}

export function resolveFlowAnswer(params: ResolveFlowAnswerParams): FlowAnswerDecision {
  if (params.answer === undefined) return { kind: 'invalid' }
  if (params.node.type === 'dynamic_choice') return resolveDynamicChoice(params, params.answer)
  if (isChoiceNode(params.node)) return resolveChoice(params, params.answer)
  return resolveQuestion(params, params.answer)
}
