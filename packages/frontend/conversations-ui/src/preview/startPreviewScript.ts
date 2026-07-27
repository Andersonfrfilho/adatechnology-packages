/**
 * Roteiro que mantém o preview vivo: sem tráfego chegando, a inbox é uma tela estática e as
 * transições que o atendente precisa testar (fila de espera enchendo, handoff, devolução ao bot)
 * nunca acontecem.
 *
 * O roteiro é cíclico e determinístico — mesma ordem a cada execução. Aleatoriedade tornaria um
 * defeito visto uma vez difícil de reencontrar.
 */

import type { PreviewStore } from './previewStore'

export type PreviewScriptStep = (store: PreviewStore) => void

export const DEFAULT_PREVIEW_SCRIPT: readonly PreviewScriptStep[] = [
  (store) =>
    store.appendMessage({
      conversationId: '5511988887777',
      content: 'pode trocar o óleo por azeite?',
      direction: 'inbound',
      sender: 'customer',
    }),
  (store) => store.requestHuman('5511988887777'),
  (store) =>
    store.appendMessage({
      conversationId: '5511955554444',
      content: 'e o troco?',
      direction: 'inbound',
      sender: 'customer',
    }),
  (store) => store.setMode({ conversationId: '5511977776666', mode: 'human', assignedUserId: 'agent-2' }),
  (store) =>
    store.appendMessage({
      conversationId: '5511977776666',
      content: 'Oi Diego, sou a Ana. Já vi seu pedido.',
      direction: 'outbound',
      sender: 'agent',
    }),
  (store) => store.setMode({ conversationId: '5511966665555', mode: 'bot' }),
]

export type StartPreviewScriptParams = {
  readonly store: PreviewStore
  readonly intervalMs?: number
  readonly steps?: readonly PreviewScriptStep[]
}

const DEFAULT_INTERVAL_MS = 4000

export function startPreviewScript(params: StartPreviewScriptParams): () => void {
  const steps = params.steps ?? DEFAULT_PREVIEW_SCRIPT
  const intervalMs = params.intervalMs ?? DEFAULT_INTERVAL_MS
  let index = 0

  const timer = setInterval(() => {
    steps[index % steps.length]?.(params.store)
    index += 1
  }, intervalMs)

  return () => clearInterval(timer)
}
