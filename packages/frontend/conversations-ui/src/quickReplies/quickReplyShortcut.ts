/**
 * Detecção e inserção do atalho `/termo` — compartilhado entre `MessageComposer` e
 * `RichMessageComposer` para os dois campos abrirem e fecharem o picker do mesmo jeito.
 */

/** Casa `/termo` no início do texto ou depois de espaço, sempre no fim da string. */
const QUICK_REPLY_SHORTCUT_PATTERN = /(?:^|\s)\/([a-z0-9-]*)$/i

export type QuickReplyShortcutMatch = {
  /** Índice do primeiro caractere da "/", para a inserção saber onde trocar. */
  readonly start: number
  readonly term: string
}

/** Sem correspondência (ou depois de apagar a "/"), devolve `undefined` — é o que fecha o picker. */
export function detectQuickReplyShortcut(text: string): QuickReplyShortcutMatch | undefined {
  const match = QUICK_REPLY_SHORTCUT_PATTERN.exec(text)
  if (!match) return undefined
  return { start: match.index + (match[0].startsWith('/') ? 0 : 1), term: match[1] ?? '' }
}

export type ReplaceQuickReplyShortcutParams = {
  readonly text: string
  readonly start: number
  readonly caret: number
  readonly replacement: string
}

export type ReplaceQuickReplyShortcutResult = {
  readonly text: string
  /** Onde o cursor deve ficar depois — logo após o texto inserido. */
  readonly caret: number
}

/** Troca o `/termo` (de `start` até `caret`) pelo corpo já resolvido. */
export function replaceQuickReplyShortcut({
  text,
  start,
  caret,
  replacement,
}: ReplaceQuickReplyShortcutParams): ReplaceQuickReplyShortcutResult {
  return {
    text: text.slice(0, start) + replacement + text.slice(caret),
    caret: start + replacement.length,
  }
}
