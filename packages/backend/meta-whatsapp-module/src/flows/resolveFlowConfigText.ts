/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Primeiro texto definido de uma cadeia de `FlowConfigText` (fixo ou resolvido por empresa). A cadeia
 * é a precedência que o runner já tinha — nó, motivo, padrão do host, padrão do pacote —; resolvedor
 * que devolve `undefined` passa a vez ao próximo.
 */

import type { FlowConfigText, FlowTextContext } from './flowRunner.types'

export type ResolveFlowConfigTextParams = {
  readonly chain: readonly (FlowConfigText | undefined)[]
  readonly context: FlowTextContext
  /** Resolvedor que lançou: reporta e segue a cadeia (o padrão do pacote sempre fecha a resposta). */
  readonly onError?: (error: unknown) => Promise<void> | void
}

async function resolveOne(
  text: FlowConfigText | undefined,
  params: ResolveFlowConfigTextParams,
): Promise<string | undefined> {
  if (typeof text !== 'function') return text
  try {
    return await text(params.context)
  } catch (error) {
    await params.onError?.(error)
    return undefined
  }
}

export async function resolveFlowConfigText(params: ResolveFlowConfigTextParams): Promise<string | undefined> {
  for (const text of params.chain) {
    // Em sequência de propósito: o primeiro definido vence, e o resolvedor seguinte nem deve ser chamado.
    const resolved = await resolveOne(text, params)
    if (resolved !== undefined) return resolved
  }
  return undefined
}
