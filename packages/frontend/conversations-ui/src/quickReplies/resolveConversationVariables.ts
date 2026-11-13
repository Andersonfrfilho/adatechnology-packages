import type { RichComposerVariable } from '../RichMessageComposer'
import type { ConversationVariable } from './quickReply.types'

export type ResolveConversationVariablesParams = {
  readonly conversationVariables?: readonly ConversationVariable[] | undefined
  /** @deprecated Use `conversationVariables`. */
  readonly quickReplyVariables?: Readonly<Record<string, string>> | undefined
  /** @deprecated Use `conversationVariables`. */
  readonly composerVariables?: readonly RichComposerVariable[] | undefined
}

export type ResolveConversationVariablesResult = {
  readonly quickReplyVariables: Readonly<Record<string, string>> | undefined
  readonly composerVariables: readonly RichComposerVariable[] | undefined
}

const MARKER_PATTERN = /^\{\{\s*([\w.]+)\s*\}\}$/

/** Nome que `applyQuickReplyVariables` casa; marcador fora do formato cai no `id`. */
function variableNameOf(variable: ConversationVariable): string {
  return MARKER_PATTERN.exec(variable.marker)?.[1] ?? variable.id
}

/**
 * Deriva os dois formatos antigos da lista nova. Quando a lista vem, ela manda — misturar as fontes
 * faria o chip e o botão de variáveis mostrarem valores diferentes. Sem ela, as props antigas seguem
 * valendo para os produtos que ainda não migraram.
 */
export function resolveConversationVariables({
  conversationVariables,
  quickReplyVariables,
  composerVariables,
}: ResolveConversationVariablesParams): ResolveConversationVariablesResult {
  if (!conversationVariables) return { quickReplyVariables, composerVariables }
  // Valor vazio não é oferecido: inserir o nada no texto só esconde que o dado falta.
  const known = conversationVariables.filter((variable) => variable.value !== '')
  return {
    quickReplyVariables: Object.fromEntries(known.map((variable) => [variableNameOf(variable), variable.value])),
    composerVariables: known.map(({ id, label, value }) => ({ id, label, value })),
  }
}
