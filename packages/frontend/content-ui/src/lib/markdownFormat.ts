/**
 * Copyright (c) 2026 Ada Technology. MIT License.
 *
 * Transformações puras do editor de corpo: texto + seleção entram, texto + seleção saem. O formato
 * guardado continua Markdown; a barra só escreve a sintaxe por quem edita.
 */

export type TextSelection = {
  readonly value: string
  readonly start: number
  readonly end: number
}

export type LinePrefixKind = 'heading2' | 'heading3' | 'bulletList' | 'numberedList' | 'quote'

const LINE_PREFIX_PATTERN: Record<LinePrefixKind, RegExp> = {
  heading2: /^## /,
  heading3: /^### /,
  bulletList: /^[-*+] /,
  numberedList: /^\d+\. /,
  quote: /^> /,
}

const ANY_BLOCK_PREFIX = /^(#{1,6} |[-*+] |\d+\. |> )/

function replaceRange(source: TextSelection, from: number, to: number, text: string, select: [number, number]) {
  return {
    value: source.value.slice(0, from) + text + source.value.slice(to),
    start: from + select[0],
    end: from + select[1],
  }
}

export function insertText(source: TextSelection, text: string): TextSelection {
  return replaceRange(source, source.start, source.end, text, [text.length, text.length])
}

/** Envolve a seleção (`**x**`); com a seleção já envolvida, desfaz. Sem seleção, usa o texto de exemplo. */
export function toggleWrap(source: TextSelection, marker: string, placeholder: string): TextSelection {
  const { value, start, end } = source
  const selected = value.slice(start, end)
  const isWrappedOutside =
    value.slice(start - marker.length, start) === marker && value.slice(end, end + marker.length) === marker
  if (isWrappedOutside && start >= marker.length) {
    return replaceRange(source, start - marker.length, end + marker.length, selected, [0, selected.length])
  }
  const isWrappedInside =
    selected.length > marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)
  if (isWrappedInside) {
    const inner = selected.slice(marker.length, selected.length - marker.length)
    return replaceRange(source, start, end, inner, [0, inner.length])
  }
  const content = selected || placeholder
  return replaceRange(source, start, end, `${marker}${content}${marker}`, [
    marker.length,
    marker.length + content.length,
  ])
}

function lineBounds(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  return { from, to: nextBreak === -1 ? value.length : nextBreak }
}

/** Aplica o prefixo de bloco em cada linha da seleção; se todas já o têm, remove (liga e desliga). */
export function toggleLinePrefix(source: TextSelection, kind: LinePrefixKind, placeholder: string): TextSelection {
  const { from, to } = lineBounds(source.value, source.start, source.end)
  const block = source.value.slice(from, to)
  const lines = block.split('\n')
  const pattern = LINE_PREFIX_PATTERN[kind]
  const isAlreadyApplied = lines.every((line) => pattern.test(line))
  const next = lines.map((line, index) => {
    const bare = line.replace(ANY_BLOCK_PREFIX, '')
    if (isAlreadyApplied) return bare
    const text = bare || (lines.length === 1 ? placeholder : '')
    if (kind === 'heading2') return `## ${text}`
    if (kind === 'heading3') return `### ${text}`
    if (kind === 'bulletList') return `- ${text}`
    if (kind === 'numberedList') return `${index + 1}. ${text}`
    return `> ${text}`
  })
  const result = next.join('\n')
  return replaceRange(source, from, to, result, [0, result.length])
}

export function insertLink(
  source: TextSelection,
  params: { readonly url: string; readonly text?: string },
): TextSelection {
  const label = params.text?.trim() || source.value.slice(source.start, source.end) || params.url
  const markdown = `[${label}](${params.url})`
  return replaceRange(source, source.start, source.end, markdown, [markdown.length, markdown.length])
}

export function insertImage(
  source: TextSelection,
  params: { readonly url: string; readonly alt: string },
): TextSelection {
  const markdown = `![${params.alt.replace(/[\][]/g, '')}](${params.url})`
  return replaceRange(source, source.start, source.end, markdown, [markdown.length, markdown.length])
}

export function isAbsoluteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
