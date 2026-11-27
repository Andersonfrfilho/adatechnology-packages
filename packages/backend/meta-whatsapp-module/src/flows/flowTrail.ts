/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Rastro das perguntas feitas na conversa, para a palavra global `back`. Cada entrada guarda a posição
 * e o contexto como estava quando a pergunta foi feita, então voltar também desfaz o que veio depois.
 */

import { DEFAULT_MAX_BACK_TRAIL, FLOW_RUNTIME_CONTEXT_KEY, FLOW_TRAIL_CONTEXT_KEY } from './flowRunner.constant'

export type FlowTrailEntry = {
  readonly flowKey: string
  readonly nodeId: string
  readonly context: Record<string, unknown>
}

export function trailOf(context: Readonly<Record<string, unknown>>): FlowTrailEntry[] {
  const trail = context[FLOW_TRAIL_CONTEXT_KEY]
  return Array.isArray(trail) ? (trail as FlowTrailEntry[]) : []
}

export function withTrail(context: Record<string, unknown>, trail: readonly FlowTrailEntry[]): Record<string, unknown> {
  const { [FLOW_TRAIL_CONTEXT_KEY]: _discarded, ...rest } = context
  return trail.length > 0 ? { ...rest, [FLOW_TRAIL_CONTEXT_KEY]: trail } : rest
}

/** Acrescenta a pergunta atual, a menos que ela já seja a última (nova tentativa, "ver mais"). */
export function withTrailEntry(
  context: Record<string, unknown>,
  position: { readonly flowKey: string; readonly nodeId: string },
): Record<string, unknown> {
  const trail = trailOf(context)
  const last = trail.at(-1)
  if (last && last.flowKey === position.flowKey && last.nodeId === position.nodeId) return context
  const {
    [FLOW_TRAIL_CONTEXT_KEY]: _trail,
    [FLOW_RUNTIME_CONTEXT_KEY]: _runtime,
    ...snapshot
  } = context
  const entry: FlowTrailEntry = { ...position, context: snapshot }
  return { ...context, [FLOW_TRAIL_CONTEXT_KEY]: [...trail, entry].slice(-DEFAULT_MAX_BACK_TRAIL) }
}
