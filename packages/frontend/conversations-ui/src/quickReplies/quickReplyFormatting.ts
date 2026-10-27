/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Edição pura do texto da mensagem pronta pela barra de formatação — seguindo as regras do WhatsApp:
 * o marcador não pode encostar em espaço, cada linha é formatada sozinha, e clicar de novo desliga.
 */

import { FORMATTING_ACTION, WHATSAPP_MARKER_BY_ACTION, type FormattingAction } from '../lib/composer-formatting'

export type WrapSelectionParams = {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly marker: string
}

export type TextSelectionEdit = {
  readonly text: string
  readonly selectionStart: number
  readonly selectionEnd: number
}

const LEADING_WHITESPACE = /^\s*/
const TRAILING_WHITESPACE = /\s*$/

function isWrappedBy(core: string, marker: string): boolean {
  return core.length >= marker.length * 2 && core.startsWith(marker) && core.endsWith(marker)
}

type ToggleLineParams = { readonly line: string; readonly marker: string; readonly shouldUnwrap: boolean }

function toggleLine({ line, marker, shouldUnwrap }: ToggleLineParams): string {
  if (!line.trim()) return line
  const leading = LEADING_WHITESPACE.exec(line)?.[0] ?? ''
  const trailing = TRAILING_WHITESPACE.exec(line)?.[0] ?? ''
  const core = line.slice(leading.length, line.length - trailing.length)
  const toggled = shouldUnwrap ? core.slice(marker.length, core.length - marker.length) : marker + core + marker
  return leading + toggled + trailing
}

function wrapLines({ text, start, end, marker }: WrapSelectionParams): TextSelectionEdit {
  const lines = text.slice(start, end).split('\n')
  const shouldUnwrap = lines.filter((line) => line.trim()).every((line) => isWrappedBy(line.trim(), marker))
  const replaced = lines.map((line) => toggleLine({ line, marker, shouldUnwrap })).join('\n')
  return {
    text: text.slice(0, start) + replaced + text.slice(end),
    selectionStart: start,
    selectionEnd: start + replaced.length,
  }
}

/**
 * Envolve (ou desliga) a formatação da seleção. Sem seleção, abre o par e deixa o cursor no meio —
 * é o que permite clicar em "Negrito" antes de digitar.
 */
export function wrapSelection({ text, start, end, marker }: WrapSelectionParams): TextSelectionEdit {
  const selected = text.slice(start, end)
  if (!selected.trim()) {
    return {
      text: text.slice(0, start) + marker + selected + marker + text.slice(end),
      selectionStart: start + marker.length,
      selectionEnd: end + marker.length,
    }
  }
  if (selected.includes('\n')) return wrapLines({ text, start, end, marker })

  const coreStart = start + (LEADING_WHITESPACE.exec(selected)?.[0].length ?? 0)
  const coreEnd = end - (TRAILING_WHITESPACE.exec(selected)?.[0].length ?? 0)
  const core = text.slice(coreStart, coreEnd)
  const before = text.slice(0, coreStart)
  const after = text.slice(coreEnd)
  const size = marker.length

  if (isWrappedBy(core, marker)) {
    const unwrapped = core.slice(size, core.length - size)
    return { text: before + unwrapped + after, selectionStart: coreStart, selectionEnd: coreStart + unwrapped.length }
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      text: before.slice(0, before.length - size) + core + after.slice(size),
      selectionStart: coreStart - size,
      selectionEnd: coreEnd - size,
    }
  }
  return {
    text: before + marker + core + marker + after,
    selectionStart: coreStart + size,
    selectionEnd: coreEnd + size,
  }
}

/** As ações do campo rico mais as que só o texto puro da mensagem pronta oferece. */
export const QUICK_REPLY_FORMATTING_ACTION = {
  ...FORMATTING_ACTION,
  INLINE_CODE: 'inlineCode',
  BULLETED_LIST: 'bulletedList',
  NUMBERED_LIST: 'numberedList',
  QUOTE: 'quote',
} as const
export type QuickReplyFormattingAction =
  (typeof QUICK_REPLY_FORMATTING_ACTION)[keyof typeof QUICK_REPLY_FORMATTING_ACTION]

type LinePrefixAction =
  | typeof QUICK_REPLY_FORMATTING_ACTION.BULLETED_LIST
  | typeof QUICK_REPLY_FORMATTING_ACTION.NUMBERED_LIST
  | typeof QUICK_REPLY_FORMATTING_ACTION.QUOTE

const LINE_PREFIX_PATTERN: Readonly<Record<LinePrefixAction, RegExp>> = {
  [QUICK_REPLY_FORMATTING_ACTION.BULLETED_LIST]: /^[-*] /,
  [QUICK_REPLY_FORMATTING_ACTION.NUMBERED_LIST]: /^\d+\. /,
  [QUICK_REPLY_FORMATTING_ACTION.QUOTE]: /^> /,
}

const INLINE_MARKER_BY_ACTION: Readonly<Partial<Record<QuickReplyFormattingAction, string>>> = {
  ...WHATSAPP_MARKER_BY_ACTION,
  [QUICK_REPLY_FORMATTING_ACTION.INLINE_CODE]: '`',
}

function isLinePrefixAction(action: QuickReplyFormattingAction): action is LinePrefixAction {
  return action in LINE_PREFIX_PATTERN
}

function prefixFor(action: LinePrefixAction, position: number): string {
  if (action === QUICK_REPLY_FORMATTING_ACTION.NUMBERED_LIST) return `${position}. `
  return action === QUICK_REPLY_FORMATTING_ACTION.QUOTE ? '> ' : '- '
}

export type ToggleLinePrefixParams = {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly action: LinePrefixAction
}

/**
 * Lista, lista numerada e citação valem por linha: o prefixo vai em cada linha tocada pela seleção
 * (numerando em sequência) e sai de todas quando todas já o têm. Linha em branco no meio fica como está.
 */
export function toggleLinePrefix({ text, start, end, action }: ToggleLinePrefixParams): TextSelectionEdit {
  const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
  const searchFrom = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nextBreak = text.indexOf('\n', searchFrom)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const original = text.slice(lineStart, lineEnd)
  const lines = original.split('\n')
  const pattern = LINE_PREFIX_PATTERN[action]
  const filledLines = lines.filter((line) => line.trim())
  const shouldRemove = filledLines.length > 0 && filledLines.every((line) => pattern.test(line))

  let position = 0
  const replaced = lines
    .map((line) => {
      if (shouldRemove) return line.replace(pattern, '')
      if (!line.trim() && lines.length > 1) return line
      position += 1
      return prefixFor(action, position) + line.replace(pattern, '')
    })
    .join('\n')

  const nextText = text.slice(0, lineStart) + replaced + text.slice(lineEnd)
  if (start === end) {
    const caret = Math.max(lineStart, start + replaced.length - original.length)
    return { text: nextText, selectionStart: caret, selectionEnd: caret }
  }
  return { text: nextText, selectionStart: lineStart, selectionEnd: lineStart + replaced.length }
}

export type ComputeFormattingEditParams = {
  readonly text: string
  readonly selectionStart: number
  readonly selectionEnd: number
  readonly action: QuickReplyFormattingAction
  readonly maximumLength: number
}

/** `undefined` quando o resultado passaria do limite do campo — o `maxLength` só barra a digitação. */
export function computeFormattingEdit({
  text,
  selectionStart,
  selectionEnd,
  action,
  maximumLength,
}: ComputeFormattingEditParams): TextSelectionEdit | undefined {
  const edit = isLinePrefixAction(action)
    ? toggleLinePrefix({ text, start: selectionStart, end: selectionEnd, action })
    : wrapSelection({ text, start: selectionStart, end: selectionEnd, marker: INLINE_MARKER_BY_ACTION[action] ?? '' })
  return edit.text.length > maximumLength ? undefined : edit
}

export type FormattingShortcutEvent = {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly isComposing: boolean
}

const SHORTCUT_ACTION_BY_KEY: Readonly<Record<string, FormattingAction>> = {
  b: FORMATTING_ACTION.BOLD,
  i: FORMATTING_ACTION.ITALIC,
}

export const FORMATTING_SHORTCUT_HINT: Readonly<Partial<Record<QuickReplyFormattingAction, string>>> = {
  [FORMATTING_ACTION.BOLD]: 'Ctrl/⌘+B',
  [FORMATTING_ACTION.ITALIC]: 'Ctrl/⌘+I',
}

export function formattingActionForShortcut(event: FormattingShortcutEvent): FormattingAction | undefined {
  if (event.isComposing || event.shiftKey || event.altKey) return undefined
  if (!(event.ctrlKey || event.metaKey)) return undefined
  return SHORTCUT_ACTION_BY_KEY[event.key.toLowerCase()]
}

export type ChangedRange = {
  readonly start: number
  /** Fim no texto anterior. */
  readonly end: number
  readonly insertedText: string
}

/** Menor trecho que muda — substituir só ele mantém o desfazer nativo do campo enxuto. */
export function changedRange(previous: string, next: string): ChangedRange {
  let prefix = 0
  const shortest = Math.min(previous.length, next.length)
  while (prefix < shortest && previous[prefix] === next[prefix]) prefix += 1
  let suffix = 0
  while (suffix < shortest - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) {
    suffix += 1
  }
  return { start: prefix, end: previous.length - suffix, insertedText: next.slice(prefix, next.length - suffix) }
}
